"""Bangla (বাংলা) version of the landing page.

Written in everyday Bangla the way BDS students actually talk — friendly "তুমি",
common English terms kept as students use them (কোর্স, ক্লাস, প্রফ, ভাইভা, নোটস).

Each pair is (English inner HTML exactly as it appears in the page, Bangla replacement).
build.py finds every element whose content matches the English text and tags it so
the language switch can swap it. If you edit English text in template.html, update the
matching line here too (the build fails loudly if an English string is not found).
"""

A_SITE = '<a href="https://mediversebd.com" target="_blank" rel="noopener" style="color:var(--cyan)">mediversebd.com</a>'
A_YT = '<a href="https://youtube.com/@mediversedental?si=VuCm4kPuqcdEORaJ" target="_blank" rel="noopener" style="color:var(--cyan)">@mediversedental</a>'

PAGE = [
    # navigation
    ("About", "আমাদের কথা"),
    ("Courses", "কোর্স"),
    ("Mentors", "মেন্টর"),
    ("Stories", "রিভিউ"),
    ("FAQ", "প্রশ্ন-উত্তর"),
    ("Enroll Now", "এনরোল করো"),
    ("Home", "হোম"),
    ("About MediVerse", "মেডিভার্স সম্পর্কে"),
    ("Mentor Panel", "মেন্টর প্যানেল"),
    ("Student Stories", "স্টুডেন্টদের রিভিউ"),
    ("FAQ &amp; Contact", "প্রশ্ন-উত্তর ও যোগাযোগ"),
    ("Follow MediVerse Dental", "আমাদের সাথে যুক্ত থাকো"),
    ("Enroll at mediversebd.com", "mediversebd.com-এ এনরোল করো"),

    # hero
    ("<i></i>BDS Education · Built for Bangladesh", "<i></i>BDS-এর পড়াশোনা · বাংলাদেশের জন্য"),
    ('Future Dentistry<br><span class="grad-text">Begins Here.</span>',
     'ডেন্টিস্ট্রির ভবিষ্যৎ<br><span class="grad-text">শুরু এখান থেকেই।</span>'),
    ("Phase-wise BDS courses, expert mentors and exam-focused notes — everything a dental student in Bangladesh needs, on one modern platform.",
     "ফেজ ধরে সাজানো BDS কোর্স, অভিজ্ঞ মেন্টর আর পরীক্ষায় সত্যিই কাজে লাগে এমন নোটস — একজন ডেন্টাল স্টুডেন্টের যা যা লাগে, সব এক জায়গায়।"),
    ("Explore Courses", "কোর্সগুলো দেখো"),
    ("Meet the Mentors", "মেন্টরদের চেনো"),
    ("Students reached", "স্টুডেন্ট আমাদের সাথে"),
    ("Academic courses", "কোর্স"),
    ("Expert mentors", "এক্সপার্ট মেন্টর"),
    ("Free classes", "ফ্রি ক্লাস"),

    # about
    ("<i></i>About MediVerse Dental", "<i></i>মেডিভার্স ডেন্টাল আসলে কী?"),
    ('Dental education, <span class="grad-text">re-engineered</span> for how you actually study.',
     'ডেন্টালের পড়া, <span class="grad-text">তোমার মতো করে</span> সাজানো।'),
    ("MediVerse Dental is an academic platform built by expert mentors to help BDS students learn better, prepare smarter and access quality resources — wherever they are in Bangladesh.",
     "মেডিভার্স ডেন্টাল হলো BDS স্টুডেন্টদের জন্য একটা অনলাইন পড়াশোনার প্ল্যাটফর্ম। ঢাকায় থাকো বা দেশের যেকোনো জায়গায় — বুঝে পড়া, গুছিয়ে প্রস্তুতি নেওয়া আর ভালো রিসোর্স হাতের কাছে পাওয়া, সবই এখানে।"),
    ("Our goal is simple — make quality dental education accessible, structured and easier to learn.",
     "আমাদের চাওয়াটা খুব সোজা — ভালো মানের ডেন্টাল পড়াশোনা যেন সবার নাগালে থাকে, গোছানো থাকে, আর পড়তে গিয়ে ঝামেলা না লাগে।"),
    ("From 1st Prof SDM to Final Prof OMS, every course is mapped to the BDS curriculum and standard textbooks, taught by mentors who have sat the same exams you're preparing for.",
     "ফার্স্ট প্রফের SDM থেকে ফাইনাল প্রফের OMS — প্রতিটা কোর্স BDS সিলেবাস আর স্ট্যান্ডার্ড টেক্সটবুক মেনে বানানো। পড়ান সেই মেন্টররা, যারা নিজেরাই এই পরীক্ষাগুলো পার করে এসেছেন।"),
    ("Trusted by <b>4,700+ BDS students</b> from dental colleges nationwide",
     "দেশের নানা ডেন্টাল কলেজের <b>৪,৭০০+ স্টুডেন্ট</b> আমাদের সাথে পড়ছে"),
    ("Courses covering every BDS professional phase", "কোর্স — BDS-এর প্রতিটা প্রফের জন্য"),
    ("Recorded + live classes", "রেকর্ডেড + লাইভ ক্লাস"),
    ("Learn at your pace with HD recordings, then clear doubts in live sessions.",
     "রেকর্ডেড ক্লাস দেখো নিজের সময়মতো, আর যেটা বুঝবে না — লাইভে এসে জিজ্ঞেস করে নাও।"),
    ("Exam-mapped notes", "পরীক্ষা মাথায় রেখে নোটস"),
    ("Diagram-heavy class notes, viva prep and question practice built for BDS profs.",
     "ডায়াগ্রাম দিয়ে বোঝানো নোটস, ভাইভার প্রস্তুতি আর প্রশ্ন সলভ — সবই প্রফের কথা ভেবে।"),
    ("24/7 mentor support", "২৪/৭ মেন্টর সাপোর্ট"),
    ("Chatbox support and a mentor panel that actually replies to your questions.",
     "চ্যাটবক্সে যখন খুশি প্রশ্ন করো — মেন্টররা সত্যিই উত্তর দেন।"),
    ("1st Phase", "১ম ফেজ"),
    ("2nd Phase", "২য় ফেজ"),
    ("3rd Phase", "৩য় ফেজ"),
    ("Final Phase", "ফাইনাল ফেজ"),
    ("SDM, Dental Anatomy, Physiology, Biochemistry — the foundation, with diagram-heavy notes and viva prep.",
     "SDM, Dental Anatomy, Physiology, Biochemistry — বেসটা এখানেই শক্ত হয়। সাথে ডায়াগ্রামসহ নোটস আর ভাইভা প্রস্তুতি।"),
    ("Pharmacology, Pathology, Microbiology — dense subjects distilled into exam-ready summaries.",
     "Pharmacology, Pathology, Microbiology — ভারী ভারী সাবজেক্টগুলো ছোট করে, পরীক্ষার উপযোগী করে গুছিয়ে দেওয়া।"),
    ("Oral Pathology &amp; Medicine, Periodontology, Medicine, Surgery — where clinical thinking takes shape.",
     "Oral Pathology &amp; Medicine, Periodontology, Medicine, Surgery — এখান থেকেই ক্লিনিক্যালি ভাবতে শেখা শুরু।"),
    ("OMS, Conservative, Orthodontics, Prosthodontics, Pedodontics — mastery for finals.",
     "OMS, Conservative, Orthodontics, Prosthodontics, Pedodontics — ফাইনালের পুরো প্রস্তুতি।"),

    # courses
    ("<i></i>Courses", "<i></i>কোর্স"),
    ('Find the course for <span class="grad-text">your phase</span>.',
     '<span class="grad-text">তোমার ফেজের</span> কোর্সটা খুঁজে নাও।'),
    ("Filter by professional phase or search a subject — every course is built from board-relevant textbooks and exam patterns.",
     "ফেজ বেছে নাও, নয়তো সাবজেক্টের নাম লিখে সার্চ করো — প্রতিটা কোর্স টেক্সটবুক আর প্রফের প্রশ্নের ধরন মেনে বানানো।"),
    ("All", "সব"),
    ("View course", "কোর্সটা দেখো"),
    ("Coming soon", "শীঘ্রই আসছে"),
    ("No course matches that search yet — ", "এই নামে এখনো কোনো কোর্স নেই — "),
    ("ask us on WhatsApp", "হোয়াটসঅ্যাপে আমাদের জিজ্ঞেস করো"),
    ("See all courses on mediversebd.com", "সব কোর্স দেখো mediversebd.com-এ"),

    # mentors
    ("<i></i>Expert Mentor Panel", "<i></i>এক্সপার্ট মেন্টর প্যানেল"),
    ('Learn from expert mentors who\'ve <span class="grad-text">sat where you\'re sitting</span>.',
     'শেখো তাদের কাছে, <span class="grad-text">যারা একদিন তোমার জায়গাতেই ছিলেন</span>।'),
    ("15+ mentors from DMC, DDC, SSMC, MDCH, IMC and more — toppers, FCPS trainees and practising clinicians.",
     "DMC, DDC, SSMC, MDCH, IMC সহ দেশের নানা কলেজের ১৫+ মেন্টর — কেউ প্রফে টপার, কেউ FCPS ট্রেইনি, কেউ প্র্যাকটিসিং ক্লিনিশিয়ান।"),

    # stories
    ("<i></i>Student stories", "<i></i>স্টুডেন্টদের কথা"),
    ('What students say after <span class="grad-text">MediVerse</span>.',
     '<span class="grad-text">মেডিভার্স</span> নিয়ে স্টুডেন্টরা কী বলছে'),
    ("The SDM notes were exactly what came in my viva. I didn't need any other book that term.",
     "SDM-এর নোটসে যা ছিল, ভাইভায় হুবহু সেগুলোই ধরেছে। ওই টার্মে আর অন্য কোনো বই খুলতেই হয়নি।"),
    ("Having a mentor actually reply to my questions changed how I studied for finals.",
     "প্রশ্ন করলে মেন্টর সত্যি সত্যিই উত্তর দিতেন — ফাইনালের আগে আমার পড়ার ধরনটাই বদলে গেছে।"),
    ("The OMS case book format matches the exam so closely it felt like practice runs.",
     "OMS কেস বুকের ফরম্যাট পরীক্ষার সাথে এত মিলে যায় যে মনে হচ্ছিল আগেই একবার পরীক্ষা দিয়ে ফেলেছি।"),
    ('<b style="color:var(--ink)">3rd Prof student</b><br>Dhaka Dental College',
     '<b style="color:var(--ink)">থার্ড প্রফের স্টুডেন্ট</b><br>ঢাকা ডেন্টাল কলেজ'),
    ('<b style="color:var(--ink)">4th Prof student</b><br>Chattagram Dental College',
     '<b style="color:var(--ink)">ফোর্থ প্রফের স্টুডেন্ট</b><br>চট্টগ্রাম ডেন্টাল কলেজ'),
    ('<b style="color:var(--ink)">Final Prof student</b><br>BDS, Bangladesh',
     '<b style="color:var(--ink)">ফাইনাল প্রফের স্টুডেন্ট</b><br>BDS, বাংলাদেশ'),

    # faq
    ("<i></i>FAQ", "<i></i>প্রশ্ন-উত্তর"),
    ('Questions? <span class="grad-text">Answered.</span>', 'মনে প্রশ্ন? <span class="grad-text">উত্তর এখানেই।</span>'),
    ("Can't find what you need? Message us on WhatsApp or Telegram — the MediVerse team usually replies within a few hours.",
     "যা খুঁজছ পাচ্ছ না? হোয়াটসঅ্যাপ বা টেলিগ্রামে নক দাও — সাধারণত কয়েক ঘণ্টার মধ্যেই রিপ্লাই পেয়ে যাবে।"),
    ("How do I enroll in a course?", "কোর্সে এনরোল করব কীভাবে?"),
    (f"Open the course page on {A_SITE}, tap Enroll and complete payment (bKash / Nagad / card). You get access in your dashboard right away.",
     f"{A_SITE}-এ গিয়ে কোর্সটা খোলো, Enroll-এ চাপ দাও, তারপর বিকাশ / নগদ / কার্ডে পেমেন্ট করে ফেলো। পেমেন্ট হলেই কোর্স তোমার ড্যাশবোর্ডে চলে আসবে।"),
    ("Are classes live or recorded?", "ক্লাস কি লাইভ, নাকি রেকর্ডেড?"),
    ("Both. Core lectures are recorded so you can study at your own pace; live sessions and doubt-clearing classes are announced on our Facebook group and Telegram channel.",
     "দুটোই। মূল ক্লাসগুলো রেকর্ডেড, তাই নিজের সুবিধামতো দেখতে পারবে। লাইভ ক্লাস আর ডাউট সলভিং সেশনের আপডেট পাবে আমাদের ফেসবুক গ্রুপ আর টেলিগ্রাম চ্যানেলে।"),
    ("How long do I keep access?", "কোর্স কতদিন দেখা যাবে?"),
    ("Most full courses give you access for up to 2 years — long enough to revise before your professional exam. Check each course page for exact duration.",
     "বেশিরভাগ ফুল কোর্সে ২ বছর পর্যন্ত অ্যাক্সেস থাকে — প্রফের আগে রিভিশন দেওয়ার জন্য যথেষ্ট সময়। কোন কোর্সের মেয়াদ কত, সেটা কোর্স পেজেই লেখা আছে।"),
    ("Can I watch on my phone?", "মোবাইল থেকে ক্লাস করা যাবে?"),
    ("Yes. The platform is website-based and works on any phone, tablet or laptop browser — no app install needed. Bookmarking lets you jump back to where you left off.",
     "অবশ্যই। কোনো অ্যাপ নামাতে হবে না — ফোন, ট্যাব বা ল্যাপটপের ব্রাউজার থেকেই চলবে। বুকমার্ক করে রাখলে যেখানে থেমেছিলে, পরে ঠিক সেখান থেকেই শুরু করতে পারবে।"),
    ("Do you offer free classes?", "ফ্রি ক্লাস আছে?"),
    (f"Yes — 100+ free classes are on our YouTube channel. Subscribe to {A_YT} to get notified.",
     f"আছে! আমাদের ইউটিউব চ্যানেলে ১০০+ ফ্রি ক্লাস আছে। নতুন ক্লাসের আপডেট পেতে {A_YT} সাবস্ক্রাইব করে রাখো।"),

    # contact
    ("Ready to study smarter this term?", "এই টার্মে স্মার্টলি পড়তে রেডি?"),
    ("Join thousands of BDS students already learning with MediVerse Dental. Talk to our team or jump straight into a course.",
     "হাজারো BDS স্টুডেন্ট এখন মেডিভার্স ডেন্টালে পড়ছে। কিছু জানার থাকলে আমাদের সাথে কথা বলো, নয়তো সরাসরি কোর্সে ঢুকে পড়ো।"),
    ("Start Learning", "পড়া শুরু করো"),
    ("Chat on WhatsApp", "হোয়াটসঅ্যাপে কথা বলো"),
    ("Updates &amp; community", "আপডেট আর কমিউনিটি"),
    ("100+ free classes", "১০০+ ফ্রি ক্লাস"),
    ("Notes &amp; notices", "নোটস আর নোটিশ"),

    # footer
    ("Future Dentistry Begins Here. A BDS education platform guided by expert mentors — phase-wise courses, mentor guidance and exam-focused notes for students across Bangladesh.",
     "ডেন্টিস্ট্রির ভবিষ্যৎ শুরু এখান থেকেই। এক্সপার্ট মেন্টরদের হাতে গড়া BDS পড়াশোনার প্ল্যাটফর্ম — সারা দেশের স্টুডেন্টদের জন্য ফেজ অনুযায়ী কোর্স, মেন্টরের গাইডলাইন আর পরীক্ষার নোটস।"),
    ("Explore", "ঘুরে দেখো"),
    ("Platform", "প্ল্যাটফর্ম"),
    ("Contact", "যোগাযোগ"),
    ("Privacy Policy", "প্রাইভেসি পলিসি"),
    ("Terms of Service", "শর্তাবলি"),
    ("MediVerse Dental. All rights reserved.", "মেডিভার্স ডেন্টাল। সর্বস্বত্ব সংরক্ষিত।"),
    ("Made for BDS students, by expert mentors 🦷", "BDS স্টুডেন্টদের জন্য, এক্সপার্ট মেন্টরদের হাতে বানানো 🦷"),
]

# Course descriptions (English text must match the COURSES list in build.py)
COURSE_DESC = {
    "Complete Science of Dental Materials, exam-mapped from the start.": "পুরো Science of Dental Materials — শুরু থেকেই পরীক্ষার কথা মাথায় রেখে সাজানো।",
    "A fast, exam-focused refresher covering SDM's high-yield topics.": "SDM-এর ইম্পর্ট্যান্ট টপিকগুলোর ঝটপট রিভিশন — পরীক্ষার ঠিক আগে কাজে লাগবে।",
    "Tooth morphology through full arch relations and occlusion.": "দাঁতের মরফোলজি থেকে শুরু করে ফুল আর্চ রিলেশন আর অক্লুশন পর্যন্ত।",
    "Foundational general anatomy, structured for early BDS.": "BDS-এর শুরুতে জেনারেল অ্যানাটমির বেসটা শক্ত করার কোর্স।",
    "Continues core anatomy with viva-focused revision notes.": "অ্যানাটমির বাকি অংশ, সাথে ভাইভার জন্য রিভিশন নোটস।",
    "Tooth form and function, mapped for practical and theory exams.": "দাঁতের গঠন আর কাজ — প্র্যাকটিক্যাল আর থিওরি, দুই পরীক্ষার জন্যই।",
    "Systems-based physiology notes built for BDS first phase.": "সিস্টেম ধরে ধরে ফিজিওলজি নোটস, BDS ফার্স্ট ফেজের জন্য বানানো।",
    "Core biochemical concepts, simplified for dental students.": "বায়োকেমিস্ট্রির মূল কনসেপ্টগুলো, ডেন্টাল স্টুডেন্টদের জন্য সহজ করে।",
    "Drug classes and dental prescriptions, exam-focused.": "ড্রাগের ক্লাস আর ডেন্টাল প্রেসক্রিপশন — পরীক্ষায় যেভাবে আসে, সেভাবেই।",
    "Concept-first notes on inflammation, neoplasia and healing.": "ইনফ্লামেশন, নিওপ্লাসিয়া, হিলিং — আগে কনসেপ্ট পরিষ্কার, তারপর নোটস।",
    "Organism-wise notes built around board-relevant clinical links.": "অর্গানিজম ধরে ধরে নোটস, সাথে পরীক্ষায় আসা ক্লিনিক্যাল কানেকশন।",
    "General pharmacology principles ahead of dental applications.": "জেনারেল ফার্মাকোলজির বেসিক — ডেন্টাল ফার্মাকোলজিতে ঢোকার আগে।",
    "Combined Oral Pathology, Oral Medicine and Periodontology.": "Oral Pathology, Oral Medicine আর Periodontology — এক কোর্সেই।",
    "Question-based rapid revision of Periodontology and Oral Pathology for written and viva.": "প্রফের প্রশ্ন ধরে Periodontology আর Oral Pathology-র ঝটপট রিভিশন — লিখিত আর ভাইভা দুটোর জন্যই।",
    "Core general medicine concepts relevant to dental practice and exams.": "ডেন্টাল প্র্যাকটিস আর পরীক্ষায় যতটুকু মেডিসিন লাগে, ঠিক ততটুকু।",
    "Full prep for Surgery Paper I — written, viva, OSPE, long and short cases.": "সার্জারি পেপার ওয়ানের পুরো প্রস্তুতি — লিখিত, ভাইভা, OSPE, লং কেস আর শর্ট কেস।",
    "OMS concepts through to exam-format short and long cases.": "OMS-এর কনসেপ্ট থেকে শুরু করে পরীক্ষার মতো করে শর্ট আর লং কেস।",
    "Cavity classification through endodontic protocols, simplified.": "ক্যাভিটি ক্লাসিফিকেশন থেকে এন্ডোডন্টিক প্রোটোকল — সহজ ভাষায়।",
    "Core orthodontic concepts distilled for finals revision.": "অর্থোডন্টিক্সের জরুরি কনসেপ্টগুলো, ফাইনালের রিভিশনের জন্য বেছে আনা।",
    "Step-by-step OPG, PNS and OM view interpretation with real cases.": "রিয়েল কেস দেখে দেখে ধাপে ধাপে OPG, PNS আর OM ভিউ পড়া শেখো।",
    "Removable and fixed prosthodontics, exam-focused summaries.": "রিমুভেবল আর ফিক্সড প্রস্থোডন্টিক্স — পরীক্ষার জন্য গোছানো সামারি।",
    "Child dental care and management, simplified for finals.": "বাচ্চাদের ডেন্টাল কেয়ার আর ম্যানেজমেন্ট, ফাইনালের জন্য সহজ করে।",
}

# Non-element strings used by the script
UI = {
    "title": "মেডিভার্স ডেন্টাল — ডেন্টিস্ট্রির ভবিষ্যৎ শুরু এখান থেকেই",
    "search": "সার্চ করো, যেমন OPG, Anatomy, Ortho…",
}
