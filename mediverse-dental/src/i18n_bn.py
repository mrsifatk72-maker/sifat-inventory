"""Bangla (বাংলা) translations for the landing page.

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
    ("Courses", "কোর্সসমূহ"),
    ("Mentors", "মেন্টর"),
    ("Stories", "অভিজ্ঞতা"),
    ("FAQ", "প্রশ্নোত্তর"),
    ("Enroll Now", "এনরোল করুন"),
    ("Home", "হোম"),
    ("About MediVerse", "মেডিভার্স সম্পর্কে"),
    ("Mentor Panel", "মেন্টর প্যানেল"),
    ("Student Stories", "শিক্ষার্থীদের অভিজ্ঞতা"),
    ("FAQ &amp; Contact", "প্রশ্নোত্তর ও যোগাযোগ"),
    ("Follow MediVerse Dental", "মেডিভার্স ডেন্টালকে ফলো করুন"),
    ("Enroll at mediversebd.com", "mediversebd.com-এ এনরোল করুন"),

    # hero
    ("<i></i>BDS Education · Built for Bangladesh", "<i></i>BDS শিক্ষা · বাংলাদেশের জন্য তৈরি"),
    ('Future Dentistry<br><span class="grad-text">Begins Here.</span>',
     'ভবিষ্যতের ডেন্টিস্ট্রি<br><span class="grad-text">শুরু এখানেই।</span>'),
    ("Phase-wise BDS courses, expert mentors and exam-focused notes — everything a dental student in Bangladesh needs, on one modern platform.",
     "ফেজ-ভিত্তিক BDS কোর্স, অভিজ্ঞ মেন্টর আর পরীক্ষা-কেন্দ্রিক নোট — বাংলাদেশের একজন ডেন্টাল শিক্ষার্থীর যা দরকার, সবই এক আধুনিক প্ল্যাটফর্মে।"),
    ("Explore Courses", "কোর্সগুলো দেখুন"),
    ("Meet the Mentors", "মেন্টরদের সাথে পরিচিত হোন"),
    ("Students reached", "শিক্ষার্থী"),
    ("Academic courses", "একাডেমিক কোর্স"),
    ("Expert mentors", "অভিজ্ঞ মেন্টর"),
    ("Free classes", "ফ্রি ক্লাস"),

    # about
    ("<i></i>About MediVerse Dental", "<i></i>মেডিভার্স ডেন্টাল সম্পর্কে"),
    ('Dental education, <span class="grad-text">re-engineered</span> for how you actually study.',
     'ডেন্টাল শিক্ষা, <span class="grad-text">নতুনভাবে সাজানো</span> — আপনার পড়ার ধরন অনুযায়ী।'),
    ("MediVerse Dental is an academic platform built by expert mentors to help BDS students learn better, prepare smarter and access quality resources — wherever they are in Bangladesh.",
     "মেডিভার্স ডেন্টাল অভিজ্ঞ মেন্টরদের হাতে গড়া একটি একাডেমিক প্ল্যাটফর্ম — যাতে বাংলাদেশের যেকোনো প্রান্তের BDS শিক্ষার্থীরা আরও ভালোভাবে শিখতে, স্মার্টভাবে প্রস্তুতি নিতে এবং মানসম্মত রিসোর্স পেতে পারে।"),
    ("Our goal is simple — make quality dental education accessible, structured and easier to learn.",
     "আমাদের লক্ষ্য সহজ — মানসম্মত ডেন্টাল শিক্ষাকে সহজলভ্য, গোছানো এবং শেখার জন্য সহজ করা।"),
    ("From 1st Prof SDM to Final Prof OMS, every course is mapped to the BDS curriculum and standard textbooks, taught by mentors who have sat the same exams you're preparing for.",
     "১ম প্রফের SDM থেকে ফাইনাল প্রফের OMS পর্যন্ত — প্রতিটি কোর্স BDS কারিকুলাম ও স্ট্যান্ডার্ড টেক্সটবুক অনুযায়ী সাজানো, পড়ান এমন মেন্টররা যারা নিজেরাই এই পরীক্ষাগুলো দিয়ে এসেছেন।"),
    ("Trusted by <b>4,700+ BDS students</b> from dental colleges nationwide",
     "সারাদেশের ডেন্টাল কলেজের <b>৪,৭০০+ BDS শিক্ষার্থীর</b> আস্থা"),
    ("Courses covering every BDS professional phase", "BDS-এর প্রতিটি প্রফেশনাল ফেজের কোর্স"),
    ("Recorded + live classes", "রেকর্ডেড + লাইভ ক্লাস"),
    ("Learn at your pace with HD recordings, then clear doubts in live sessions.",
     "HD রেকর্ডিং দেখে নিজের গতিতে শিখুন, তারপর লাইভ সেশনে ডাউট ক্লিয়ার করুন।"),
    ("Exam-mapped notes", "পরীক্ষা-ভিত্তিক নোট"),
    ("Diagram-heavy class notes, viva prep and question practice built for BDS profs.",
     "ডায়াগ্রামসমৃদ্ধ ক্লাস নোট, ভাইভা প্রস্তুতি ও প্রশ্ন অনুশীলন — BDS প্রফের জন্য তৈরি।"),
    ("24/7 mentor support", "২৪/৭ মেন্টর সাপোর্ট"),
    ("Chatbox support and a mentor panel that actually replies to your questions.",
     "চ্যাটবক্স সাপোর্ট আর এমন মেন্টর প্যানেল, যারা সত্যিই আপনার প্রশ্নের উত্তর দেয়।"),
    ("1st Phase", "১ম ফেজ"),
    ("2nd Phase", "২য় ফেজ"),
    ("3rd Phase", "৩য় ফেজ"),
    ("Final Phase", "ফাইনাল ফেজ"),
    ("SDM, Dental Anatomy, Physiology, Biochemistry — the foundation, with diagram-heavy notes and viva prep.",
     "SDM, Dental Anatomy, Physiology, Biochemistry — ভিত্তি গড়ার সময়, ডায়াগ্রামসমৃদ্ধ নোট ও ভাইভা প্রস্তুতিসহ।"),
    ("Pharmacology, Pathology, Microbiology — dense subjects distilled into exam-ready summaries.",
     "Pharmacology, Pathology, Microbiology — ভারী বিষয়গুলো পরীক্ষার উপযোগী সংক্ষিপ্ত আকারে।"),
    ("Oral Pathology &amp; Medicine, Periodontology, Medicine — where clinical thinking takes shape.",
     "Oral Pathology &amp; Medicine, Periodontology, Medicine — যেখানে ক্লিনিক্যাল চিন্তাভাবনা গড়ে ওঠে।"),
    ("OMS, Conservative, Orthodontics, Prosthodontics, Pedodontics — mastery for finals.",
     "OMS, Conservative, Orthodontics, Prosthodontics, Pedodontics — ফাইনালের জন্য পূর্ণ প্রস্তুতি।"),

    # courses
    ("<i></i>Courses", "<i></i>কোর্সসমূহ"),
    ('Find the course for <span class="grad-text">your phase</span>.',
     '<span class="grad-text">আপনার ফেজের</span> কোর্স খুঁজে নিন।'),
    ("Filter by professional phase or search a subject — every course is built from board-relevant textbooks and exam patterns.",
     "প্রফেশনাল ফেজ অনুযায়ী ফিল্টার করুন বা বিষয় লিখে খুঁজুন — প্রতিটি কোর্স বোর্ড-প্রাসঙ্গিক টেক্সটবুক ও প্রশ্নের ধরন অনুযায়ী তৈরি।"),
    ("All", "সব"),
    ("View course", "কোর্স দেখুন"),
    ("Coming soon", "শীঘ্রই আসছে"),
    ("No course matches that search yet — ", "এই নামে এখনো কোনো কোর্স পাওয়া যায়নি — "),
    ("ask us on WhatsApp", "হোয়াটসঅ্যাপে জিজ্ঞেস করুন"),
    ("See all courses on mediversebd.com", "mediversebd.com-এ সব কোর্স দেখুন"),

    # mentors
    ("<i></i>Expert Mentor Panel", "<i></i>অভিজ্ঞ মেন্টর প্যানেল"),
    ('Learn from expert mentors who\'ve <span class="grad-text">sat where you\'re sitting</span>.',
     'শিখুন এমন মেন্টরদের কাছে, <span class="grad-text">যারা আপনার জায়গায় বসেই এসেছেন</span>।'),
    ("15+ mentors from DMC, DDC, SSMC, MDCH, IMC and more — toppers, FCPS trainees and practising clinicians.",
     "DMC, DDC, SSMC, MDCH, IMC সহ বিভিন্ন প্রতিষ্ঠানের ১৫+ মেন্টর — টপার, FCPS ট্রেইনি ও প্র্যাকটিসিং ক্লিনিশিয়ান।"),

    # stories
    ("<i></i>Student stories", "<i></i>শিক্ষার্থীদের কথা"),
    ('What students say after <span class="grad-text">MediVerse</span>.',
     '<span class="grad-text">মেডিভার্স</span> নিয়ে শিক্ষার্থীরা যা বলছে।'),
    ("The SDM notes were exactly what came in my viva. I didn't need any other book that term.",
     "SDM নোটে যা ছিল, ভাইভায় ঠিক সেগুলোই এসেছে। ওই টার্মে আর কোনো বই লাগেনি।"),
    ("Having a mentor actually reply to my questions changed how I studied for finals.",
     "মেন্টর সত্যিই আমার প্রশ্নের উত্তর দিতেন — এতে ফাইনালের পড়ার ধরনটাই বদলে গেছে।"),
    ("The OMS case book format matches the exam so closely it felt like practice runs.",
     "OMS কেস বুকের ফরম্যাট পরীক্ষার সাথে এতটাই মিলে যায় যে মনে হয়েছে আগেই প্র্যাকটিস করে ফেলেছি।"),
    ('<b style="color:var(--ink)">3rd Prof student</b><br>Dhaka Dental College',
     '<b style="color:var(--ink)">৩য় প্রফের শিক্ষার্থী</b><br>ঢাকা ডেন্টাল কলেজ'),
    ('<b style="color:var(--ink)">4th Prof student</b><br>Chattagram Dental College',
     '<b style="color:var(--ink)">৪র্থ প্রফের শিক্ষার্থী</b><br>চট্টগ্রাম ডেন্টাল কলেজ'),
    ('<b style="color:var(--ink)">Final Prof student</b><br>BDS, Bangladesh',
     '<b style="color:var(--ink)">ফাইনাল প্রফের শিক্ষার্থী</b><br>BDS, বাংলাদেশ'),

    # faq
    ("<i></i>FAQ", "<i></i>প্রশ্নোত্তর"),
    ('Questions? <span class="grad-text">Answered.</span>', 'প্রশ্ন আছে? <span class="grad-text">উত্তর এখানে।</span>'),
    ("Can't find what you need? Message us on WhatsApp or Telegram — the MediVerse team usually replies within a few hours.",
     "যা খুঁজছেন পাচ্ছেন না? হোয়াটসঅ্যাপ বা টেলিগ্রামে মেসেজ দিন — মেডিভার্স টিম সাধারণত কয়েক ঘণ্টার মধ্যেই উত্তর দেয়।"),
    ("How do I enroll in a course?", "কীভাবে কোর্সে এনরোল করব?"),
    (f"Open the course page on {A_SITE}, tap Enroll and complete payment (bKash / Nagad / card). You get access in your dashboard right away.",
     f"{A_SITE}-এ কোর্স পেজ খুলুন, Enroll-এ ট্যাপ করে পেমেন্ট সম্পন্ন করুন (বিকাশ / নগদ / কার্ড)। সাথে সাথেই ড্যাশবোর্ডে অ্যাক্সেস পেয়ে যাবেন।"),
    ("Are classes live or recorded?", "ক্লাস লাইভ নাকি রেকর্ডেড?"),
    ("Both. Core lectures are recorded so you can study at your own pace; live sessions and doubt-clearing classes are announced on our Facebook group and Telegram channel.",
     "দুটোই। মূল লেকচারগুলো রেকর্ডেড, তাই নিজের সুবিধামতো পড়তে পারবেন; লাইভ সেশন ও ডাউট-ক্লিয়ারিং ক্লাসের ঘোষণা আমাদের ফেসবুক গ্রুপ ও টেলিগ্রাম চ্যানেলে দেওয়া হয়।"),
    ("How long do I keep access?", "কতদিন অ্যাক্সেস থাকবে?"),
    ("Most full courses give you access for up to 2 years — long enough to revise before your professional exam. Check each course page for exact duration.",
     "বেশিরভাগ ফুল কোর্সে ২ বছর পর্যন্ত অ্যাক্সেস থাকে — প্রফেশনাল পরীক্ষার আগে রিভিশনের জন্য যথেষ্ট। নির্দিষ্ট মেয়াদ জানতে প্রতিটি কোর্স পেজ দেখুন।"),
    ("Can I watch on my phone?", "মোবাইলে কি দেখা যাবে?"),
    ("Yes. The platform is website-based and works on any phone, tablet or laptop browser — no app install needed. Bookmarking lets you jump back to where you left off.",
     "হ্যাঁ। প্ল্যাটফর্মটি ওয়েবসাইট-ভিত্তিক, যেকোনো ফোন, ট্যাবলেট বা ল্যাপটপের ব্রাউজারে চলে — কোনো অ্যাপ ইনস্টল লাগবে না। বুকমার্ক ফিচার দিয়ে যেখানে থেমেছিলেন সেখান থেকেই আবার শুরু করতে পারবেন।"),
    ("Do you offer free classes?", "ফ্রি ক্লাস আছে কি?"),
    (f"Yes — 100+ free classes are on our YouTube channel. Subscribe to {A_YT} to get notified.",
     f"হ্যাঁ — আমাদের ইউটিউব চ্যানেলে ১০০+ ফ্রি ক্লাস আছে। নতুন ক্লাসের নোটিফিকেশন পেতে {A_YT} সাবস্ক্রাইব করুন।"),

    # contact
    ("Ready to study smarter this term?", "এই টার্মে স্মার্টভাবে পড়তে প্রস্তুত?"),
    ("Join thousands of BDS students already learning with MediVerse Dental. Talk to our team or jump straight into a course.",
     "হাজারো BDS শিক্ষার্থীর সাথে যোগ দিন, যারা ইতিমধ্যে মেডিভার্স ডেন্টালে শিখছে। আমাদের টিমের সাথে কথা বলুন অথবা সরাসরি কোর্স শুরু করুন।"),
    ("Start Learning", "শেখা শুরু করুন"),
    ("Chat on WhatsApp", "হোয়াটসঅ্যাপে চ্যাট করুন"),
    ("Updates &amp; community", "আপডেট ও কমিউনিটি"),
    ("100+ free classes", "১০০+ ফ্রি ক্লাস"),
    ("Notes &amp; notices", "নোট ও নোটিশ"),

    # footer
    ("Future Dentistry Begins Here. A BDS education platform guided by expert mentors — phase-wise courses, mentor guidance and exam-focused notes for students across Bangladesh.",
     "ভবিষ্যতের ডেন্টিস্ট্রি শুরু এখানেই। অভিজ্ঞ মেন্টরদের তত্ত্বাবধানে একটি BDS শিক্ষা প্ল্যাটফর্ম — সারাদেশের শিক্ষার্থীদের জন্য ফেজ-ভিত্তিক কোর্স, মেন্টর গাইডেন্স ও পরীক্ষা-কেন্দ্রিক নোট।"),
    ("Explore", "এক্সপ্লোর"),
    ("Platform", "প্ল্যাটফর্ম"),
    ("Contact", "যোগাযোগ"),
    ("Privacy Policy", "প্রাইভেসি পলিসি"),
    ("Terms of Service", "শর্তাবলি"),
    ("MediVerse Dental. All rights reserved.", "মেডিভার্স ডেন্টাল। সর্বস্বত্ব সংরক্ষিত।"),
    ("Made for BDS students, by expert mentors 🦷", "BDS শিক্ষার্থীদের জন্য, অভিজ্ঞ মেন্টরদের হাতে তৈরি 🦷"),
]

# Course descriptions (English text must match the COURSES list in build.py)
COURSE_DESC = {
    "Complete Science of Dental Materials, exam-mapped from the start.": "সম্পূর্ণ Science of Dental Materials, শুরু থেকেই পরীক্ষা অনুযায়ী সাজানো।",
    "A fast, exam-focused refresher covering SDM's high-yield topics.": "SDM-এর হাই-ইল্ড টপিকগুলোর দ্রুত, পরীক্ষা-কেন্দ্রিক রিভিশন।",
    "Tooth morphology through full arch relations and occlusion.": "দাঁতের মরফোলজি থেকে শুরু করে ফুল আর্চ রিলেশন ও অক্লুশন পর্যন্ত।",
    "Foundational general anatomy, structured for early BDS.": "BDS-এর শুরুর জন্য সাজানো জেনারেল অ্যানাটমির ভিত্তি।",
    "Continues core anatomy with viva-focused revision notes.": "ভাইভা-কেন্দ্রিক রিভিশন নোটসহ কোর অ্যানাটমির পরবর্তী অংশ।",
    "Tooth form and function, mapped for practical and theory exams.": "দাঁতের গঠন ও কাজ — প্র্যাকটিক্যাল ও থিওরি পরীক্ষা অনুযায়ী।",
    "Systems-based physiology notes built for BDS first phase.": "BDS ১ম ফেজের জন্য সিস্টেম-ভিত্তিক ফিজিওলজি নোট।",
    "Core biochemical concepts, simplified for dental students.": "ডেন্টাল শিক্ষার্থীদের জন্য সহজ করে বোঝানো বায়োকেমিস্ট্রির মূল ধারণা।",
    "Drug classes and dental prescriptions, exam-focused.": "ড্রাগ ক্লাস ও ডেন্টাল প্রেসক্রিপশন — পরীক্ষা-কেন্দ্রিক।",
    "Concept-first notes on inflammation, neoplasia and healing.": "ইনফ্লামেশন, নিওপ্লাসিয়া ও হিলিং নিয়ে কনসেপ্ট-ভিত্তিক নোট।",
    "Organism-wise notes built around board-relevant clinical links.": "বোর্ড-প্রাসঙ্গিক ক্লিনিক্যাল সংযোগসহ অর্গানিজম-ভিত্তিক নোট।",
    "General pharmacology principles ahead of dental applications.": "ডেন্টাল প্রয়োগের আগে জেনারেল ফার্মাকোলজির মূলনীতি।",
    "Combined Oral Pathology, Oral Medicine and Periodontology.": "Oral Pathology, Oral Medicine ও Periodontology একসাথে।",
    "Rapid revision of Cawson & Carranza's core concepts before exams.": "পরীক্ষার আগে Cawson ও Carranza-র মূল ধারণাগুলোর দ্রুত রিভিশন।",
    "Core general medicine concepts relevant to dental practice and exams.": "ডেন্টাল প্র্যাকটিস ও পরীক্ষার জন্য প্রয়োজনীয় জেনারেল মেডিসিনের মূল ধারণা।",
    "OMS concepts through to exam-format short and long cases.": "OMS-এর ধারণা থেকে শুরু করে পরীক্ষার ফরম্যাটে শর্ট ও লং কেস।",
    "Cavity classification through endodontic protocols, simplified.": "ক্যাভিটি ক্লাসিফিকেশন থেকে এন্ডোডন্টিক প্রোটোকল — সহজভাবে।",
    "Core orthodontic concepts distilled for finals revision.": "ফাইনাল রিভিশনের জন্য অর্থোডন্টিক্সের মূল ধারণা সংক্ষেপে।",
    "Step-by-step OPG, PNS and OM view interpretation with real cases.": "রিয়েল কেসসহ ধাপে ধাপে OPG, PNS ও OM ভিউ ইন্টারপ্রিটেশন।",
    "Removable and fixed prosthodontics, exam-focused summaries.": "রিমুভেবল ও ফিক্সড প্রস্থোডন্টিক্স — পরীক্ষা-কেন্দ্রিক সারসংক্ষেপ।",
    "Child dental care and management, simplified for finals.": "শিশুদের ডেন্টাল কেয়ার ও ম্যানেজমেন্ট — ফাইনালের জন্য সহজভাবে।",
}

# Non-element strings used by the script
UI = {
    "title": "মেডিভার্স ডেন্টাল — ভবিষ্যতের ডেন্টিস্ট্রি শুরু এখানেই",
    "search": "খুঁজুন, যেমন OPG, Anatomy, Ortho…",
}
