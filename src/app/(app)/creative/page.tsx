"use client"

import { useState } from "react"
import { motion } from "motion/react"
import {
  Image,
  Box,
  FileText,
  Wand2,
  Download,
  Loader2,
  Upload,
  Sparkles,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  generateImage,
  generate3DModel,
  parseDocument,
  runReplicateModel,
  type GeneratedImage,
  type Generated3DModel,
  type ParsedDocument,
} from "@/lib/creative-api"
import { toast } from "sonner"

export default function CreativePage() {
  const [activeTab, setActiveTab] = useState("image")
  const [loading, setLoading] = useState(false)

  // Image generation state with proper types
  const [imagePrompt, setImagePrompt] = useState("")
  const [imageStyle, setImageStyle] = useState<"realistic" | "artistic" | "cartoon" | "sketch" | "oil_painting" | "watercolor">("realistic")
  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "4:3" | "3:2">("1:1")
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])

  // 3D model state with proper types
  const [modelPrompt, setModelPrompt] = useState("")
  const [modelType, setModelType] = useState<"product" | "architecture" | "character" | "abstract" | "furniture">("product")
  const [modelFormat, setModelFormat] = useState<"glb" | "obj" | "fbx" | "usdz">("glb")
  const [generated3DModel, setGenerated3DModel] = useState<Generated3DModel | null>(null)

  // Document parsing state
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [parseOptions, setParseOptions] = useState({
    extract_text: true,
    extract_tables: true,
    extract_images: false,
    ocr_language: "en",
  })
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null)

  // Custom model state
  const [customModel, setCustomModel] = useState("")
  const [customInput, setCustomInput] = useState("{}")

  async function handleGenerateImage() {
    if (!imagePrompt.trim()) {
      toast.error("Please enter an image description")
      return
    }

    setLoading(true)
    try {
      const images = await generateImage({
        prompt: imagePrompt,
        style: imageStyle,
        aspect_ratio: imageAspectRatio,
        quality: "standard",
        num_images: 2,
      })
      setGeneratedImages(images)
      toast.success("Images generated successfully!")
    } catch (error) {
      toast.error("Failed to generate images")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate3DModel() {
    if (!modelPrompt.trim()) {
      toast.error("Please enter a 3D model description")
      return
    }

    setLoading(true)
    try {
      const model = await generate3DModel({
        prompt: modelPrompt,
        object_type: modelType,
        detail_level: "medium",
        texture_style: "realistic",
        file_format: modelFormat,
      })
      setGenerated3DModel(model)
      toast.success("3D model generated successfully!")
    } catch (error) {
      toast.error("Failed to generate 3D model")
    } finally {
      setLoading(false)
    }
  }

  async function handleParseDocument() {
    if (!documentFile) {
      toast.error("Please select a document to parse")
      return
    }

    setLoading(true)
    try {
      // Convert file to base64
      const base64 = await fileToBase64(documentFile)
      const fileExtension = documentFile.name.split('.').pop()?.toLowerCase() || ""

      // Map file extensions to supported file types
      let fileType: "pdf" | "image" | "docx" | "xlsx"
      if (fileExtension === "pdf") {
        fileType = "pdf"
      } else if (["png", "jpg", "jpeg", "gif", "webp"].includes(fileExtension)) {
        fileType = "image"
      } else if (fileExtension === "docx" || fileExtension === "doc") {
        fileType = "docx"
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        fileType = "xlsx"
      } else {
        toast.error("Unsupported file type")
        setLoading(false)
        return
      }

      const result = await parseDocument({
        document_base64: base64,
        file_type: fileType,
        parse_options: parseOptions,
      })

      setParsedDocument(result)
      toast.success("Document parsed successfully!")
    } catch (error) {
      toast.error("Failed to parse document")
    } finally {
      setLoading(false)
    }
  }

  async function handleRunCustomModel() {
    if (!customModel.trim()) {
      toast.error("Please enter a model name")
      return
    }

    setLoading(true)
    try {
      const input = JSON.parse(customInput)
      const result = await runReplicateModel({
        model: customModel,
        input,
      })
      toast.success("Model run successfully!")
      console.log("Result:", result)
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error("Invalid JSON input")
      } else {
        toast.error("Failed to run model")
      }
    } finally {
      setLoading(false)
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const base64 = reader.result as string
        resolve(base64.split(',')[1]) // Remove data:image/png;base64, prefix
      }
      reader.onerror = reject
    })
  }

  function downloadImage(url: string, filename: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creative Tools</h1>
          <p className="text-muted-foreground">
            AI-powered creative generation and document processing
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="image">
            <Image className="mr-2 h-4 w-4" />
            Image Generation
          </TabsTrigger>
          <TabsTrigger value="3d">
            <Box className="mr-2 h-4 w-4" />
            3D Models
          </TabsTrigger>
          <TabsTrigger value="document">
            <FileText className="mr-2 h-4 w-4" />
            Document Parser
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Wand2 className="mr-2 h-4 w-4" />
            Custom Models
          </TabsTrigger>
        </TabsList>

        {/* Image Generation Tab */}
        <TabsContent value="image" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Image Generation</CardTitle>
              <CardDescription>
                Create unique images from text descriptions using advanced AI models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-prompt">Image Description</Label>
                <Textarea
                  id="image-prompt"
                  placeholder="A futuristic Dubai skyline with flying cars and holographic displays..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Style</Label>
                  <Select value={imageStyle} onValueChange={(value) => setImageStyle(value as "realistic" | "artistic" | "cartoon" | "sketch" | "oil_painting" | "watercolor")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realistic">Realistic</SelectItem>
                      <SelectItem value="artistic">Artistic</SelectItem>
                      <SelectItem value="cartoon">Cartoon</SelectItem>
                      <SelectItem value="sketch">Sketch</SelectItem>
                      <SelectItem value="oil_painting">Oil Painting</SelectItem>
                      <SelectItem value="watercolor">Watercolor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  <Select value={imageAspectRatio} onValueChange={(value) => setImageAspectRatio(value as "1:1" | "16:9" | "9:16" | "4:3" | "3:2")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1:1">Square (1:1)</SelectItem>
                      <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                      <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                      <SelectItem value="4:3">Standard (4:3)</SelectItem>
                      <SelectItem value="3:2">Classic (3:2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGenerateImage} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Images
                  </>
                )}
              </Button>

              {/* Generated Images */}
              {generatedImages.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Generated Images</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {generatedImages.map((image) => (
                      <motion.div
                        key={image.image_id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative group"
                      >
                        <img
                          src={image.url}
                          alt={image.prompt}
                          className="w-full rounded-lg shadow-lg"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => window.open(image.url, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => downloadImage(image.url, `generated-${image.image_id}.png`)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                        <Badge className="absolute top-2 left-2" variant="secondary">
                          {image.style}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3D Models Tab */}
        <TabsContent value="3d" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>3D Model Generation</CardTitle>
              <CardDescription>
                Create 3D models from text descriptions for products, architecture, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model-prompt">Model Description</Label>
                <Textarea
                  id="model-prompt"
                  placeholder="A modern minimalist office chair with ergonomic design..."
                  value={modelPrompt}
                  onChange={(e) => setModelPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Object Type</Label>
                  <Select value={modelType} onValueChange={(value) => setModelType(value as "product" | "architecture" | "character" | "abstract" | "furniture")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="architecture">Architecture</SelectItem>
                      <SelectItem value="character">Character</SelectItem>
                      <SelectItem value="abstract">Abstract</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>File Format</Label>
                  <Select value={modelFormat} onValueChange={(value) => setModelFormat(value as "glb" | "obj" | "fbx" | "usdz")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glb">GLB (Universal)</SelectItem>
                      <SelectItem value="obj">OBJ (Standard)</SelectItem>
                      <SelectItem value="fbx">FBX (Animation)</SelectItem>
                      <SelectItem value="usdz">USDZ (Apple)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGenerate3DModel} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Box className="mr-2 h-4 w-4" />
                    Generate 3D Model
                  </>
                )}
              </Button>

              {/* Generated 3D Model */}
              {generated3DModel && (
                <Alert>
                  <Box className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">3D Model Generated!</p>
                      <div className="text-sm space-y-1">
                        <p>Format: {generated3DModel.format.toUpperCase()}</p>
                        <p>Size: {generated3DModel.metadata.size_mb} MB</p>
                        <p>Vertices: {generated3DModel.metadata.vertices.toLocaleString()}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => window.open(generated3DModel.url, '_blank')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Model
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Document Parser Tab */}
        <TabsContent value="document" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Parser</CardTitle>
              <CardDescription>
                Extract text, tables, and data from PDFs, images, and documents with OCR
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document-upload">Upload Document</Label>
                <Input
                  id="document-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                />
                {documentFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {documentFile.name} ({(documentFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Parse Options</Label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={parseOptions.extract_text}
                      onChange={(e) => setParseOptions({
                        ...parseOptions,
                        extract_text: e.target.checked
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">Extract Text</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={parseOptions.extract_tables}
                      onChange={(e) => setParseOptions({
                        ...parseOptions,
                        extract_tables: e.target.checked
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">Extract Tables</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={parseOptions.extract_images}
                      onChange={(e) => setParseOptions({
                        ...parseOptions,
                        extract_images: e.target.checked
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">Extract Images</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>OCR Language</Label>
                <RadioGroup
                  value={parseOptions.ocr_language}
                  onValueChange={(value) => setParseOptions({
                    ...parseOptions,
                    ocr_language: value
                  })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="en" id="en" />
                    <Label htmlFor="en">English</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ar" id="ar" />
                    <Label htmlFor="ar">Arabic</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button onClick={handleParseDocument} disabled={loading || !documentFile} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Parse Document
                  </>
                )}
              </Button>

              {/* Parsed Results */}
              {parsedDocument && parsedDocument.status === "completed" && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Parsing Results</h4>
                    <Badge variant="outline">
                      {parsedDocument.metadata.total_pages} pages
                    </Badge>
                  </div>

                  {parsedDocument.pages.map((page) => (
                    <Card key={page.page_number}>
                      <CardHeader>
                        <CardTitle className="text-sm">Page {page.page_number}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {page.text && (
                          <div className="mb-4">
                            <h5 className="text-sm font-medium mb-2">Extracted Text</h5>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {page.text.substring(0, 500)}
                              {page.text.length > 500 && "..."}
                            </p>
                          </div>
                        )}

                        {page.tables && page.tables.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-2">Tables Found</h5>
                            <Badge>{page.tables.length} table(s)</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {parsedDocument.extracted_data && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Extracted Data</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        {parsedDocument.extracted_data.amounts && parsedDocument.extracted_data.amounts.length > 0 && (
                          <div>
                            <span className="font-medium">Amounts: </span>
                            {parsedDocument.extracted_data.amounts.map((amount, i) => (
                              <Badge key={i} variant="secondary" className="ml-1">
                                {amount.currency} {amount.value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Models Tab */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Replicate Models</CardTitle>
              <CardDescription>
                Run any Replicate model with custom parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Wand2 className="h-4 w-4" />
                <AlertDescription>
                  You can run any public model from Replicate. Examples:
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>stability-ai/sdxl (Image generation)</li>
                    <li>meta/llama-2-70b (Text generation)</li>
                    <li>openai/whisper (Speech to text)</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="custom-model">Model Name</Label>
                <Input
                  id="custom-model"
                  placeholder="e.g., stability-ai/sdxl"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-input">Input Parameters (JSON)</Label>
                <Textarea
                  id="custom-input"
                  placeholder='{"prompt": "a beautiful landscape", "num_outputs": 2}'
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>

              <Button onClick={handleRunCustomModel} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Run Model
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}