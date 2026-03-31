"use client"

import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { FileText } from "lucide-react"
import Link from "next/link"

export default function TermsPage() {
  const { language, isRTL } = useNexus()

  const lastUpdated = new Date("2026-03-20").toLocaleDateString(
    language === "ar" ? "ar-AE" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  )

  return (
    <div className="container max-w-3xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className={cn("flex items-center gap-3 mb-6", isRTL && "flex-row-reverse")}>
        <FileText className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">
          {language === "ar" ? "شروط الخدمة" : "Terms of Service"}
        </h1>
      </div>

      <p className={cn("text-sm text-muted-foreground mb-8", isRTL && "text-right")}>
        {language === "ar" ? `آخر تحديث: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
      </p>

      <div className={cn("prose prose-sm dark:prose-invert max-w-none", isRTL && "text-right")}>
        {language === "ar" ? (
          <>
            <h2>1. قبول الشروط</h2>
            <p>باستخدامك لخدمات NexusAD AI، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا لم توافق على هذه الشروط، يرجى عدم استخدام خدماتنا.</p>

            <h2>2. وصف الخدمة</h2>
            <p>NexusAD AI هي منصة ذكاء اصطناعي سيادية توفر خدمات المساعدة الذكية مع التركيز على الخصوصية وحماية البيانات. يتم تشفير بياناتك وتجزئتها عبر عقد متعددة في الإمارات العربية المتحدة.</p>

            <h2>3. حسابات المستخدمين</h2>
            <p>أنت مسؤول عن الحفاظ على سرية معلومات حسابك ومفتاح API الخاص بك. أنت توافق على إخطارنا فوراً بأي استخدام غير مصرح به. يجب أن يكون عمرك 16 عاماً أو أكثر لاستخدام خدماتنا.</p>

            <h2>4. الاستخدام المقبول</h2>
            <p>توافق على استخدام خدماتنا فقط للأغراض القانونية وبطريقة لا تنتهك حقوق الآخرين. يُحظر:</p>
            <ul>
              <li>استخدام الخدمة لأنشطة غير قانونية</li>
              <li>محاولة الوصول غير المصرح به إلى أنظمتنا</li>
              <li>إساءة استخدام خدمات الذكاء الاصطناعي لإنشاء محتوى ضار</li>
            </ul>

            <h2>5. الخصوصية والبيانات</h2>
            <p>نحن ملتزمون بحماية خصوصيتك. يتم تشفير جميع البيانات وتخزينها في مراكز بيانات الإمارات العربية المتحدة. لمزيد من التفاصيل، يرجى مراجعة <Link href="/privacy-policy" className="text-nexus-jade hover:underline">سياسة الخصوصية</Link> الخاصة بنا.</p>
            <p>بموجب قوانين حماية البيانات (GDPR/PDPL)، لديك حقوق كاملة في الوصول إلى بياناتك وتصديرها وحذفها. يمكنك ممارسة هذه الحقوق عبر <Link href="/settings" className="text-nexus-jade hover:underline">الإعدادات</Link>.</p>

            <h2>6. حقوقك في البيانات</h2>
            <p>نضمن لك الحقوق التالية:</p>
            <ul>
              <li><strong>تصدير البيانات:</strong> يمكنك تصدير جميع بياناتك بتنسيق JSON أو CSV في أي وقت</li>
              <li><strong>حذف الحساب:</strong> يمكنك حذف حسابك وجميع بياناتك نهائياً</li>
              <li><strong>إدارة الموافقة:</strong> يمكنك التحكم في ملفات تعريف الارتباط والأذونات</li>
              <li><strong>نقل البيانات:</strong> بياناتك قابلة للنقل بتنسيقات قياسية</li>
            </ul>

            <h2>7. الفوترة والدفع</h2>
            <p>تخضع الاشتراكات المدفوعة للشروط المحددة في وقت الشراء. يمكنك إلغاء اشتراكك في أي وقت، وسيبقى نشطاً حتى نهاية فترة الفوترة الحالية.</p>

            <h2>8. الملكية الفكرية</h2>
            <p>تحتفظ بملكية جميع البيانات التي تقوم بتحميلها. المحتوى الذي ينتجه الذكاء الاصطناعي بناءً على استفساراتك هو ملكك.</p>

            <h2>9. إخلاء المسؤولية</h2>
            <p>يتم تقديم الخدمات "كما هي" دون ضمانات من أي نوع. لا نتحمل المسؤولية عن أي أضرار ناتجة عن استخدام خدماتنا. مخرجات الذكاء الاصطناعي ليست بديلاً عن المشورة المهنية.</p>

            <h2>10. التعديلات</h2>
            <p>نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بأي تغييرات جوهرية قبل 30 يوماً من سريانها.</p>

            <h2>11. القانون المعمول به</h2>
            <p>تخضع هذه الشروط لقوانين الإمارات العربية المتحدة. أي نزاعات ستُحل وفقاً لأحكام محاكم الإمارات العربية المتحدة.</p>

            <h2>12. الاتصال بنا</h2>
            <p>إذا كانت لديك أي أسئلة حول هذه الشروط، يرجى الاتصال بنا على support@nexusad.ai</p>
          </>
        ) : (
          <>
            <h2>1. Acceptance of Terms</h2>
            <p>By using NexusAD AI services, you agree to be bound by these terms and conditions. If you do not agree to these terms, please do not use our services.</p>

            <h2>2. Description of Service</h2>
            <p>NexusAD AI is a sovereign AI platform providing intelligent assistance services with a focus on privacy and data protection. Your data is encrypted and sharded across multiple UAE nodes.</p>

            <h2>3. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account information and API key. You agree to notify us immediately of any unauthorized use. You must be at least 16 years old to use our services.</p>

            <h2>4. Acceptable Use</h2>
            <p>You agree to use our services only for lawful purposes and in a manner that does not infringe the rights of others. Prohibited activities include:</p>
            <ul>
              <li>Using the service for illegal activities</li>
              <li>Attempting unauthorized access to our systems</li>
              <li>Misusing AI services to create harmful content</li>
            </ul>

            <h2>5. Privacy and Data</h2>
            <p>
              We are committed to protecting your privacy. All data is encrypted and stored in UAE data centers. For full details, please review our{" "}
              <Link href="/privacy-policy" className="text-nexus-jade hover:underline">Privacy Policy</Link>.
            </p>
            <p>
              Under data protection laws (GDPR/PDPL), you have full rights to access, export, and delete your data. You can exercise these rights via{" "}
              <Link href="/settings" className="text-nexus-jade hover:underline">Settings</Link>.
            </p>

            <h2>6. Your Data Rights</h2>
            <p>We guarantee you the following rights:</p>
            <ul>
              <li><strong>Data Export:</strong> You can export all your data in JSON or CSV format at any time</li>
              <li><strong>Account Deletion:</strong> You can permanently delete your account and all data</li>
              <li><strong>Consent Management:</strong> You can control cookie and permission preferences</li>
              <li><strong>Data Portability:</strong> Your data is portable in standard formats</li>
            </ul>

            <h2>7. Billing and Payment</h2>
            <p>Paid subscriptions are subject to the terms specified at the time of purchase. You may cancel your subscription at any time, and it will remain active until the end of the current billing period.</p>

            <h2>8. Intellectual Property</h2>
            <p>You retain ownership of all data you upload. AI-generated content based on your queries belongs to you.</p>

            <h2>9. Disclaimer of Warranties</h2>
            <p>Services are provided "as is" without warranties of any kind. We are not liable for any damages resulting from use of our services. AI outputs are not a substitute for professional advice.</p>

            <h2>10. Modifications</h2>
            <p>We reserve the right to modify these terms at any time. You will be notified of any material changes at least 30 days before they take effect.</p>

            <h2>11. Governing Law</h2>
            <p>These terms are governed by the laws of the United Arab Emirates. Any disputes will be resolved in accordance with UAE court jurisdiction.</p>

            <h2>12. Contact Us</h2>
            <p>If you have any questions about these terms, please contact us at support@nexusad.ai</p>
          </>
        )}
      </div>
    </div>
  )
}
