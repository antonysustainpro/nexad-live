"use client"

import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { Shield } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicyPage() {
  const { language, isRTL } = useNexus()

  const lastUpdated = new Date("2026-03-20").toLocaleDateString(
    language === "ar" ? "ar-AE" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  )

  return (
    <div className="container max-w-3xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
        <Shield className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">
          {language === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
        </h1>
      </div>

      <p className={cn("text-sm text-muted-foreground mb-8", isRTL && "text-right")}>
        {language === "ar" ? `آخر تحديث: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
      </p>

      <div className={cn("prose prose-sm dark:prose-invert max-w-none", isRTL && "text-right")}>
        {language === "ar" ? (
          <>
            <h2>1. من نحن (المتحكم في البيانات)</h2>
            <p>NexusAD AI (المشار إليها بـ "نحن" أو "الشركة") هي المتحكم في البيانات المسؤول عن بياناتك الشخصية. مقرنا في الإمارات العربية المتحدة.</p>
            <ul>
              <li><strong>اسم الشركة:</strong> NexusAD AI</li>
              <li><strong>مسؤول حماية البيانات (DPO):</strong> privacy@nexusad.ai</li>
              <li><strong>العنوان:</strong> الإمارات العربية المتحدة</li>
            </ul>

            <h2>2. المعلومات التي نجمعها</h2>
            <p>نجمع المعلومات التي تقدمها مباشرة لنا، بما في ذلك:</p>
            <ul>
              <li><strong>معلومات الحساب:</strong> الاسم، البريد الإلكتروني، الشركة (اختياري)، الهاتف (اختياري)</li>
              <li><strong>بيانات الاستخدام:</strong> استعلامات الذكاء الاصطناعي، تفضيلات، سجل المحادثات</li>
              <li><strong>المعلومات التقنية:</strong> نوع الجهاز، عنوان IP (مجزأ)، نوع المتصفح</li>
              <li><strong>مستندات الخزنة:</strong> الملفات التي ترفعها إلى خزنتك الآمنة</li>
              <li><strong>بيانات الفوترة:</strong> معالجة عبر مزودي دفع خارجيين (لا نخزن بيانات البطاقة)</li>
            </ul>

            <h2>3. الأساس القانوني للمعالجة</h2>
            <p>نعالج بياناتك بناءً على الأسس القانونية التالية:</p>
            <ul>
              <li><strong>تنفيذ العقد:</strong> لتقديم خدماتنا لك</li>
              <li><strong>الموافقة:</strong> لملفات تعريف الارتباط التحليلية والاتصالات التسويقية</li>
              <li><strong>المصلحة المشروعة:</strong> لتحسين خدماتنا وضمان الأمان</li>
              <li><strong>الالتزام القانوني:</strong> للامتثال للقوانين واللوائح المعمول بها</li>
            </ul>

            <h2>4. كيف نستخدم معلوماتك</h2>
            <p>نستخدم معلوماتك لـ:</p>
            <ul>
              <li>تقديم وتحسين خدمات الذكاء الاصطناعي</li>
              <li>تخصيص تجربتك وتفضيلاتك</li>
              <li>التواصل معك حول الخدمة والتحديثات</li>
              <li>ضمان الأمان ومنع الاحتيال</li>
              <li>معالجة الفوترة والدفع</li>
              <li>تحليل الاستخدام لتحسين الخدمة (بموافقتك فقط)</li>
            </ul>

            <h2>5. أمان البيانات</h2>
            <p>نستخدم إجراءات أمنية متقدمة لحماية بياناتك:</p>
            <ul>
              <li><strong>التشفير:</strong> AES-256-GCM لجميع البيانات المخزنة والمنقولة</li>
              <li><strong>التجزئة:</strong> يتم تجزئة بياناتك عبر عقد متعددة في الإمارات</li>
              <li><strong>TLS 1.3:</strong> جميع الاتصالات مشفرة أثناء النقل</li>
              <li><strong>التحكم في الوصول:</strong> صلاحيات قائمة على الأدوار مع سجلات تدقيق</li>
              <li><strong>مفاتيح التشفير:</strong> يتم إنشاؤها محلياً على جهازك، لا نرى مفتاحك الخاص أبداً</li>
            </ul>

            <h2>6. الاحتفاظ بالبيانات</h2>
            <p>نحتفظ ببياناتك وفقاً للفترات التالية:</p>
            <ul>
              <li><strong>بيانات الحساب:</strong> طالما أن حسابك نشط، بالإضافة إلى 30 يوماً بعد الحذف</li>
              <li><strong>سجل المحادثات:</strong> وفقاً لخطتك (30-365 يوماً)</li>
              <li><strong>مستندات الخزنة:</strong> حتى تقوم بحذفها</li>
              <li><strong>سجلات التدقيق:</strong> 90 يوماً</li>
              <li><strong>بيانات الفوترة:</strong> 7 سنوات (التزام قانوني)</li>
              <li><strong>النسخ الاحتياطية:</strong> يتم مسحها خلال 30 يوماً من حذف الحساب</li>
            </ul>

            <h2>7. حقوقك</h2>
            <p>بموجب قوانين حماية البيانات (GDPR/PDPL)، لديك الحق في:</p>
            <ul>
              <li><strong>الوصول:</strong> طلب نسخة من بياناتك</li>
              <li><strong>التصحيح:</strong> تصحيح بياناتك غير الدقيقة</li>
              <li><strong>الحذف:</strong> حذف حسابك وجميع بياناتك</li>
              <li><strong>النقل:</strong> تصدير بياناتك بتنسيق قابل للقراءة آلياً (JSON، CSV)</li>
              <li><strong>تقييد المعالجة:</strong> تقييد كيفية معالجة بياناتك</li>
              <li><strong>الاعتراض:</strong> الاعتراض على المعالجة القائمة على المصلحة المشروعة</li>
              <li><strong>سحب الموافقة:</strong> سحب موافقتك في أي وقت</li>
            </ul>
            <p>لممارسة هذه الحقوق، قم بزيارة <Link href="/settings" className="text-nexus-jade hover:underline">الإعدادات</Link> أو اتصل بنا على privacy@nexusad.ai. سنرد خلال 30 يوماً.</p>

            <h2>8. مشاركة البيانات مع أطراف ثالثة</h2>
            <p>نشارك بياناتك مع الفئات التالية فقط:</p>
            <ul>
              <li><strong>مزودو الذكاء الاصطناعي:</strong> يتم تجزئة استفساراتك وتنظيفها من المعلومات الشخصية قبل إرسالها. لا يتلقى أي مزود أكثر من 24% من أي استفسار</li>
              <li><strong>Vercel:</strong> استضافة التطبيق والتحليلات (بموافقتك فقط)</li>
              <li><strong>معالجي الدفع:</strong> Stripe لمعالجة المدفوعات</li>
            </ul>
            <p>لا نبيع بياناتك أبداً. لا نشارك بياناتك لأغراض إعلانية.</p>

            <h2>9. النقل الدولي للبيانات</h2>
            <p>يتم تخزين جميع بياناتك في مراكز بيانات الإمارات العربية المتحدة. عند تجزئة استفساراتك لمزودي الذكاء الاصطناعي، يتم تنظيف المعلومات الشخصية أولاً. لأي نقل دولي للبيانات، نعتمد على الضمانات التالية:</p>
            <ul>
              <li><strong>البنود التعاقدية القياسية (SCCs):</strong> موقعة مع جميع مزودي الذكاء الاصطناعي والمعالجين الفرعيين خارج الإمارات</li>
              <li><strong>قرارات الملاءمة:</strong> حيث تم الاعتراف بالولاية القضائية المتلقية كمقدمة لحماية كافية للبيانات</li>
              <li><strong>تقليل البيانات:</strong> يتم تجريد المعلومات الشخصية قبل أي نقل عبر الحدود؛ لا يتلقى أي مزود أكثر من 24% من أي استفسار</li>
              <li><strong>الامتثال لقانون PDPL الإماراتي:</strong> جميع عمليات النقل تمتثل للمرسوم بقانون اتحادي رقم 45 لسنة 2021 بشأن حماية البيانات الشخصية</li>
            </ul>

            <h2>10. ملفات تعريف الارتباط</h2>
            <p>نستخدم الأنواع التالية من ملفات تعريف الارتباط:</p>
            <ul>
              <li><strong>أساسية (مطلوبة):</strong> الجلسة، CSRF، تفضيل اللغة — لا يمكن تعطيلها</li>
              <li><strong>تحليلية (اختيارية):</strong> Vercel Analytics — تتطلب موافقتك الصريحة</li>
              <li><strong>وظيفية (اختيارية):</strong> تفضيلات السمة والعرض</li>
            </ul>
            <p>يمكنك إدارة تفضيلات ملفات تعريف الارتباط في أي وقت عبر شعار الموافقة.</p>

            <h2>11. خصوصية الأطفال</h2>
            <p>خدماتنا غير موجهة للأطفال دون سن 16 عاماً. لا نجمع عن عمد معلومات شخصية من أي شخص دون هذا السن. إذا اكتشفنا أننا جمعنا بيانات من طفل، سنحذفها فوراً.</p>

            <h2>12. إجراءات خرق البيانات</h2>
            <p>في حالة خرق البيانات:</p>
            <ul>
              <li>سنخطر السلطات المختصة خلال 72 ساعة</li>
              <li>سنخطر المستخدمين المتأثرين دون تأخير لا مبرر له</li>
              <li>سنقدم تفاصيل عن طبيعة الخرق والإجراءات المتخذة</li>
              <li>سنوثق جميع الحوادث في سجلات التدقيق الداخلية</li>
            </ul>

            <h2>13. التغييرات على هذه السياسة</h2>
            <p>قد نقوم بتحديث هذه السياسة من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني و/أو إشعار بارز في الخدمة قبل 30 يوماً من سريان التغييرات.</p>

            <h2>14. اتصل بنا</h2>
            <p>لأي أسئلة حول سياسة الخصوصية هذه أو لممارسة حقوقك:</p>
            <ul>
              <li><strong>البريد الإلكتروني:</strong> privacy@nexusad.ai</li>
              <li><strong>مسؤول حماية البيانات:</strong> dpo@nexusad.ai</li>
            </ul>
            <p>يحق لك تقديم شكوى إلى هيئة حماية البيانات المختصة إذا كنت تعتقد أن بياناتك لم تُعالج بشكل صحيح.</p>
          </>
        ) : (
          <>
            <h2>1. Who We Are (Data Controller)</h2>
            <p>NexusAD AI (referred to as "we", "us", or "the Company") is the data controller responsible for your personal data. We are based in the United Arab Emirates.</p>
            <ul>
              <li><strong>Company Name:</strong> NexusAD AI</li>
              <li><strong>Data Protection Officer (DPO):</strong> privacy@nexusad.ai</li>
              <li><strong>Address:</strong> United Arab Emirates</li>
            </ul>

            <h2>2. Information We Collect</h2>
            <p>We collect information you provide directly to us, including:</p>
            <ul>
              <li><strong>Account information:</strong> Name, email, company (optional), phone (optional)</li>
              <li><strong>Usage data:</strong> AI queries, preferences, conversation history</li>
              <li><strong>Technical information:</strong> Device type, IP address (hashed), browser type</li>
              <li><strong>Vault documents:</strong> Files you upload to your secure vault</li>
              <li><strong>Billing data:</strong> Processed by third-party payment providers (we do not store card data)</li>
            </ul>

            <h2>3. Legal Basis for Processing</h2>
            <p>We process your data based on the following legal grounds:</p>
            <ul>
              <li><strong>Contract performance:</strong> To provide our services to you</li>
              <li><strong>Consent:</strong> For analytics cookies and marketing communications</li>
              <li><strong>Legitimate interest:</strong> To improve our services and ensure security</li>
              <li><strong>Legal obligation:</strong> To comply with applicable laws and regulations</li>
            </ul>

            <h2>4. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide and improve our AI services</li>
              <li>Personalize your experience and preferences</li>
              <li>Communicate with you about the service and updates</li>
              <li>Ensure security and prevent fraud</li>
              <li>Process billing and payments</li>
              <li>Analyze usage to improve the service (with your consent only)</li>
            </ul>

            <h2>5. Data Security</h2>
            <p>We employ advanced security measures to protect your data:</p>
            <ul>
              <li><strong>Encryption:</strong> AES-256-GCM for all stored and transmitted data</li>
              <li><strong>Sharding:</strong> Your data is sharded across multiple UAE nodes</li>
              <li><strong>TLS 1.3:</strong> All communications encrypted in transit</li>
              <li><strong>Access controls:</strong> Role-based permissions with audit logging</li>
              <li><strong>Encryption keys:</strong> Generated locally on your device; we never see your private key</li>
            </ul>

            <h2>6. Data Retention</h2>
            <p>We retain your data according to the following periods:</p>
            <ul>
              <li><strong>Account data:</strong> As long as your account is active, plus 30 days after deletion</li>
              <li><strong>Conversation history:</strong> Per your plan (30-365 days)</li>
              <li><strong>Vault documents:</strong> Until you delete them</li>
              <li><strong>Audit logs:</strong> 90 days</li>
              <li><strong>Billing data:</strong> 7 years (legal obligation)</li>
              <li><strong>Backups:</strong> Purged within 30 days of account deletion</li>
            </ul>

            <h2>7. Your Rights</h2>
            <p>Under data protection laws (GDPR/PDPL), you have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Delete your account and all your data</li>
              <li><strong>Portability:</strong> Export your data in machine-readable format (JSON, CSV)</li>
              <li><strong>Restrict processing:</strong> Limit how we process your data</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interest</li>
              <li><strong>Withdraw consent:</strong> Withdraw your consent at any time</li>
            </ul>
            <p>
              To exercise these rights, visit{" "}
              <Link href="/settings" className="text-nexus-jade hover:underline">Settings</Link>{" "}
              or contact us at privacy@nexusad.ai. We will respond within 30 days.
            </p>

            <h2>8. Third-Party Data Sharing</h2>
            <p>We share your data with the following categories only:</p>
            <ul>
              <li><strong>AI providers:</strong> Queries are sharded and PII-scrubbed before being sent. No single provider receives more than 24% of any query</li>
              <li><strong>Vercel:</strong> Application hosting and analytics (with your consent only)</li>
              <li><strong>Payment processors:</strong> Stripe for payment processing</li>
            </ul>
            <p>We never sell your data. We do not share your data for advertising purposes.</p>

            <h2>9. International Data Transfers</h2>
            <p>All your data is stored in UAE data centers. When queries are sharded to AI providers, PII is scrubbed first. For any international data transfer, we rely on the following safeguards:</p>
            <ul>
              <li><strong>Standard Contractual Clauses (SCCs):</strong> Executed with all AI providers and sub-processors outside the UAE</li>
              <li><strong>Adequacy decisions:</strong> Where the receiving jurisdiction has been recognized as providing adequate data protection</li>
              <li><strong>Data minimization:</strong> PII is stripped before any cross-border transfer; no single provider receives more than 24% of any query</li>
              <li><strong>UAE PDPL compliance:</strong> All transfers comply with UAE Federal Decree-Law No. 45 of 2021 on Personal Data Protection</li>
            </ul>

            <h2>10. Cookies</h2>
            <p>We use the following types of cookies:</p>
            <ul>
              <li><strong>Essential (required):</strong> Session, CSRF, language preference -- cannot be disabled</li>
              <li><strong>Analytics (optional):</strong> Vercel Analytics -- requires your explicit consent</li>
              <li><strong>Functional (optional):</strong> Theme and display preferences</li>
            </ul>
            <p>You can manage your cookie preferences at any time via the consent banner.</p>

            <h2>11. Children&apos;s Privacy</h2>
            <p>Our services are not directed to children under the age of 16. We do not knowingly collect personal information from anyone under this age. If we discover that we have collected data from a child, we will delete it immediately.</p>

            <h2>12. Data Breach Procedures</h2>
            <p>In the event of a data breach:</p>
            <ul>
              <li>We will notify the relevant supervisory authority within 72 hours</li>
              <li>We will notify affected users without undue delay</li>
              <li>We will provide details about the nature of the breach and actions taken</li>
              <li>We will document all incidents in internal audit logs</li>
            </ul>

            <h2>13. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will notify you of any material changes via email and/or a prominent notice in the service at least 30 days before the changes take effect.</p>

            <h2>14. Contact Us</h2>
            <p>For any questions about this Privacy Policy or to exercise your rights:</p>
            <ul>
              <li><strong>Email:</strong> privacy@nexusad.ai</li>
              <li><strong>Data Protection Officer:</strong> dpo@nexusad.ai</li>
            </ul>
            <p>You have the right to lodge a complaint with a supervisory data protection authority if you believe your data has not been processed correctly.</p>
          </>
        )}
      </div>
    </div>
  )
}
