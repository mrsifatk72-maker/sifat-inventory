-- ============================================================================
-- MediVerse Dental — STAGING DATABASE SETUP — PART 5 of 5 (generated file)
-- Run the parts in order: 1 → 2 → 3 → 4 → 5, each in its own SQL Editor query.
-- All-or-nothing: if anything fails, nothing from this part is saved.
-- ============================================================================

begin;

do $$
begin
  if not (to_regclass('public.courses') is not null) then
    raise exception 'Please run PART 4 first — nothing was changed. (আগের অংশটি আগে চালান)';
  end if;
  if not (exists (select 1 from public.courses)) then
    raise exception 'Please run PART 4 first — nothing was changed. (আগের অংশটি আগে চালান)';
  end if;
  if exists (select 1 from public.mentors) then
    raise exception 'SETUP IS ALREADY COMPLETE — nothing was changed. (সেটআপ আগেই সম্পূর্ণ হয়ে গেছে)';
  end if;
end;
$$;

insert into public.mentors (slug, name, designation_en, designation_bn, credentials, session, photo_media_id, avatar_style, status, sort_order) values
  ('tanim-ahmed', 'Dr. Tanim Ahmed', 'Oral Patho · Perio · OMS · Conservative', null, 'MDCH, Session 2018-19. Expertise: Oral Pathology & Medicine, Periodontology, Oral & Maxillofacial Surgery, Conservative & Endodontics.', '2018-19', (select id from public.media where path = 'mentors/tanim.jpg'), 'photo', 'active', 10),
  ('m-r-sifat', 'Dr. M R Sifat', 'Medicine', null, 'MBBS (DMC), BCS (Health), FCPS P-1 (Medicine), MRCP P-2 (UK). DMC, Session 2014-15.', '2014-15', (select id from public.media where path = 'mentors/sifat.jpg'), 'photo', 'active', 20),
  ('firoj-ahamed-fahim', 'Firoj Ahamed Fahim', 'SDM & Dental Anatomy', null, 'Final year BDS, Sir Salimullah Medical College (Dental Unit), Session 2021-22.', '2021-22', (select id from public.media where path = 'mentors/fahim.jpg'), 'photo', 'active', 30),
  ('sirajum-munir', 'Sirajum Munir', 'General Anatomy', null, 'Pioneer Dental College (PDC), Session 2023-24.', '2023-24', (select id from public.media where path = 'mentors/munir.jpg'), 'photo', 'active', 40),
  ('khondkar-adlul-haque', 'Khondkar Adlul Haque', 'Biochemistry', null, 'Pioneer Dental College (PDC), Session 2023-24.', '2023-24', (select id from public.media where path = 'mentors/adlul.jpg'), 'photo', 'active', 50),
  ('nusrat-jahan-efty', 'Nusrat Jahan Efty', 'Dental Pharmacology', null, 'Sir Salimullah Medical College, Session 2021-22.', '2021-22', null, 'hijab_icon', 'active', 60),
  ('mahmudul-hasan-siyam', 'Dr. Mahmudul Hasan Siyam', 'Prosthodontics', null, 'SSMC, DU. Session 2018-19.', '2018-19', (select id from public.media where path = 'mentors/siyam.jpg'), 'photo', 'active', 70),
  ('faiza-tabassum', 'Dr. Faiza Tabassum', 'Orthodontics', null, 'FCPS Part II Trainee (Dhaka Dental College), Session 2017-18. 3rd in BDS Final Prof (DU). Honours in OMS, Orthodontics, Prosthodontics, Conservative, General Surgery and Dental Anatomy.', '2017-18', null, 'hijab_icon', 'active', 80),
  ('taslima-jahan-lubna', 'Dr. Taslima Jahan Lubna', 'Orthodontics', null, 'Marks Dental College, Session 2010-11. Pursuing MFDS RCSEng Part-1 and FCPS Part-1 (Orthodontics).', '2010-11', null, 'hijab_icon', 'active', 90),
  ('jannatul-ferdous', 'Dr. Jannatul Ferdous', 'Conservative & Endo', null, 'IMC, Session 2014-15. MS at BMU (Conservative Dentistry & Endodontics). Honours in Dental Public Health and Medicine.', '2014-15', null, 'hijab_icon', 'active', 100);

insert into public.course_mentors (course_id, mentor_id, role) values
  ((select id from public.courses where slug = 'sdm-full-course'), (select id from public.mentors where slug = 'firoj-ahamed-fahim'), 'lead'),
  ((select id from public.courses where slug = 'sdm-crash-course'), (select id from public.mentors where slug = 'firoj-ahamed-fahim'), 'lead'),
  ((select id from public.courses where slug = 'dental-anatomy-full-course'), (select id from public.mentors where slug = 'firoj-ahamed-fahim'), 'lead'),
  ((select id from public.courses where slug = 'anatomy-1st-term'), (select id from public.mentors where slug = 'sirajum-munir'), 'lead'),
  ((select id from public.courses where slug = 'c-and-c-oral-patho-medicine-and-perio'), (select id from public.mentors where slug = 'tanim-ahmed'), 'lead'),
  ((select id from public.courses where slug = 'crash-course-on-peri-and-oral-patho'), (select id from public.mentors where slug = 'tanim-ahmed'), 'lead'),
  ((select id from public.courses where slug = 'essential-medicine-for-bds'), (select id from public.mentors where slug = 'm-r-sifat'), 'lead');

insert into public.page_sections (key, sort_order, is_visible, content) values
  ('hero', 10, true, '{"en": {"kicker": "BDS Education · Built for Bangladesh", "heading": "Future Dentistry\n[[Begins Here.]]", "tagline": "ডেন্টাল শিক্ষার নতুন দিগন্ত", "lead": "Phase-wise BDS courses, expert mentors and exam-focused notes — everything a dental student in Bangladesh needs, on one modern platform."}, "bn": {"kicker": "BDS-এর পড়াশোনা · বাংলাদেশের জন্য", "heading": "ডেন্টিস্ট্রির ভবিষ্যৎ\n[[শুরু এখান থেকেই।]]", "tagline": "ডেন্টাল শিক্ষার নতুন দিগন্ত", "lead": "ফেজ ধরে সাজানো BDS কোর্স, অভিজ্ঞ মেন্টর আর পরীক্ষায় সত্যিই কাজে লাগে এমন নোটস — একজন ডেন্টাল স্টুডেন্টের যা যা লাগে, সব এক জায়গায়।"}, "buttons": [{"label_en": "Explore Courses", "label_bn": "কোর্সগুলো দেখো", "url": "#courses", "style": "primary", "new_tab": false}, {"label_en": "Meet the Mentors", "label_bn": "মেন্টরদের চেনো", "url": "#mentors", "style": "ghost", "new_tab": false}]}'::jsonb),
  ('about', 20, true, '{"en": {"kicker": "About MediVerse Dental", "heading": "Dental education, [[re-engineered]] for how you actually study.", "intro": "MediVerse Dental is an academic platform built by expert mentors to help BDS students learn better, prepare smarter and access quality resources — wherever they are in Bangladesh.", "mission_heading": "Our goal is simple — make quality dental education accessible, structured and easier to learn.", "mission_body": "From 1st Prof SDM to Final Prof OMS, every course is mapped to the BDS curriculum and standard textbooks, taught by mentors who have sat the same exams you''re preparing for.", "trust_line": "Trusted by 4,700+ BDS students from dental colleges nationwide", "highlight_value": "25+", "highlight_label": "Courses covering every BDS professional phase"}, "bn": {"kicker": "মেডিভার্স ডেন্টাল আসলে কী?", "heading": "ডেন্টালের পড়া, [[তোমার মতো করে]] সাজানো।", "intro": "মেডিভার্স ডেন্টাল হলো BDS স্টুডেন্টদের জন্য একটা অনলাইন পড়াশোনার প্ল্যাটফর্ম। ঢাকায় থাকো বা দেশের যেকোনো জায়গায় — বুঝে পড়া, গুছিয়ে প্রস্তুতি নেওয়া আর ভালো রিসোর্স হাতের কাছে পাওয়া, সবই এখানে।", "mission_heading": "আমাদের চাওয়াটা খুব সোজা — ভালো মানের ডেন্টাল পড়াশোনা যেন সবার নাগালে থাকে, গোছানো থাকে, আর পড়তে গিয়ে ঝামেলা না লাগে।", "mission_body": "ফার্স্ট প্রফের SDM থেকে ফাইনাল প্রফের OMS — প্রতিটা কোর্স BDS সিলেবাস আর স্ট্যান্ডার্ড টেক্সটবুক মেনে বানানো। পড়ান সেই মেন্টররা, যারা নিজেরাই এই পরীক্ষাগুলো পার করে এসেছেন।", "trust_line": "দেশের নানা ডেন্টাল কলেজের ৪,৭০০+ স্টুডেন্ট আমাদের সাথে পড়ছে", "highlight_value": "২৫+", "highlight_label": "কোর্স — BDS-এর প্রতিটা প্রফের জন্য"}, "buttons": []}'::jsonb),
  ('courses', 30, true, '{"en": {"kicker": "Courses", "heading": "Find the course for [[your phase]].", "intro": "Filter by professional phase or search a subject — every course is built from board-relevant textbooks and exam patterns.", "search_placeholder": "Search e.g. OPG, Anatomy, Ortho…"}, "bn": {"kicker": "কোর্স", "heading": "[[তোমার ফেজের]] কোর্সটা খুঁজে নাও।", "intro": "ফেজ বেছে নাও, নয়তো সাবজেক্টের নাম লিখে সার্চ করো — প্রতিটা কোর্স টেক্সটবুক আর প্রফের প্রশ্নের ধরন মেনে বানানো।", "search_placeholder": "সার্চ করো, যেমন OPG, Anatomy, Ortho…"}, "buttons": [{"label_en": "See all courses on mediversebd.com", "label_bn": "সব কোর্স দেখো mediversebd.com-এ", "url": "https://mediversebd.com", "style": "ghost", "new_tab": true}]}'::jsonb),
  ('mentors', 40, true, '{"en": {"kicker": "Expert Mentor Panel", "heading": "Learn from expert mentors who''ve [[sat where you''re sitting]].", "intro": "15+ mentors from DMC, DDC, SSMC, MDCH, IMC and more — toppers, FCPS trainees and practising clinicians."}, "bn": {"kicker": "এক্সপার্ট মেন্টর প্যানেল", "heading": "শেখো তাদের কাছে, [[যারা একদিন তোমার জায়গাতেই ছিলেন]]।", "intro": "DMC, DDC, SSMC, MDCH, IMC সহ দেশের নানা কলেজের ১৫+ মেন্টর — কেউ প্রফে টপার, কেউ FCPS ট্রেইনি, কেউ প্র্যাকটিসিং ক্লিনিশিয়ান।"}, "buttons": []}'::jsonb),
  ('stories', 50, true, '{"en": {"kicker": "Student stories", "heading": "What students say after [[MediVerse]]."}, "bn": {"kicker": "স্টুডেন্টদের কথা", "heading": "[[মেডিভার্স]] নিয়ে স্টুডেন্টরা কী বলছে"}, "buttons": []}'::jsonb),
  ('faq', 60, true, '{"en": {"kicker": "FAQ", "heading": "Questions? [[Answered.]]", "intro": "Can''t find what you need? Message us on WhatsApp or Telegram — the MediVerse team usually replies within a few hours."}, "bn": {"kicker": "প্রশ্ন-উত্তর", "heading": "মনে প্রশ্ন? [[উত্তর এখানেই।]]", "intro": "যা খুঁজছ পাচ্ছ না? হোয়াটসঅ্যাপ বা টেলিগ্রামে নক দাও — সাধারণত কয়েক ঘণ্টার মধ্যেই রিপ্লাই পেয়ে যাবে।"}, "buttons": []}'::jsonb),
  ('contact', 70, true, '{"en": {"heading": "Ready to study smarter this term?", "body": "Join thousands of BDS students already learning with MediVerse Dental. Talk to our team or jump straight into a course."}, "bn": {"heading": "এই টার্মে স্মার্টলি পড়তে রেডি?", "body": "হাজারো BDS স্টুডেন্ট এখন মেডিভার্স ডেন্টালে পড়ছে। কিছু জানার থাকলে আমাদের সাথে কথা বলো, নয়তো সরাসরি কোর্সে ঢুকে পড়ো।"}, "buttons": [{"label_en": "Start Learning", "label_bn": "পড়া শুরু করো", "url": "https://mediversebd.com", "style": "primary", "new_tab": true}, {"label_en": "Chat on WhatsApp", "label_bn": "হোয়াটসঅ্যাপে কথা বলো", "url": "https://wa.me/8801726415926?text=Hello%20MediVerse%20Dental%2C%20I%20would%20like%20to%20know%20more%20about%20your%20BDS%20courses.", "style": "ghost", "new_tab": true}]}'::jsonb);

insert into public.stats (value, suffix, label_en, label_bn, sort_order) values
  (4700, '+', 'Students reached', 'স্টুডেন্ট আমাদের সাথে', 10),
  (25, '+', 'Academic courses', 'কোর্স', 20),
  (15, '+', 'Expert mentors', 'এক্সপার্ট মেন্টর', 30),
  (100, '+', 'Free classes', 'ফ্রি ক্লাস', 40);

insert into public.features (icon, title_en, title_bn, body_en, body_bn, sort_order) values
  ('video', 'Recorded + live classes', 'রেকর্ডেড + লাইভ ক্লাস', 'Learn at your pace with HD recordings, then clear doubts in live sessions.', 'রেকর্ডেড ক্লাস দেখো নিজের সময়মতো, আর যেটা বুঝবে না — লাইভে এসে জিজ্ঞেস করে নাও।', 10),
  ('notes', 'Exam-mapped notes', 'পরীক্ষা মাথায় রেখে নোটস', 'Diagram-heavy class notes, viva prep and question practice built for BDS profs.', 'ডায়াগ্রাম দিয়ে বোঝানো নোটস, ভাইভার প্রস্তুতি আর প্রশ্ন সলভ — সবই প্রফের কথা ভেবে।', 20),
  ('chat', '24/7 mentor support', '২৪/৭ মেন্টর সাপোর্ট', 'Chatbox support and a mentor panel that actually replies to your questions.', 'চ্যাটবক্সে যখন খুশি প্রশ্ন করো — মেন্টররা সত্যিই উত্তর দেন।', 30);

insert into public.faqs (question_en, question_bn, answer_en, answer_bn, sort_order) values
  ('How do I enroll in a course?', 'কোর্সে এনরোল করব কীভাবে?', 'Open the course page on [mediversebd.com](https://mediversebd.com), tap Enroll and complete payment (bKash / Nagad / card). You get access in your dashboard right away.', '[mediversebd.com](https://mediversebd.com)-এ গিয়ে কোর্সটা খোলো, Enroll-এ চাপ দাও, তারপর বিকাশ / নগদ / কার্ডে পেমেন্ট করে ফেলো। পেমেন্ট হলেই কোর্স তোমার ড্যাশবোর্ডে চলে আসবে।', 10),
  ('Are classes live or recorded?', 'ক্লাস কি লাইভ, নাকি রেকর্ডেড?', 'Both. Core lectures are recorded so you can study at your own pace; live sessions and doubt-clearing classes are announced on our Facebook group and Telegram channel.', 'দুটোই। মূল ক্লাসগুলো রেকর্ডেড, তাই নিজের সুবিধামতো দেখতে পারবে। লাইভ ক্লাস আর ডাউট সলভিং সেশনের আপডেট পাবে আমাদের ফেসবুক গ্রুপ আর টেলিগ্রাম চ্যানেলে।', 20),
  ('How long do I keep access?', 'কোর্স কতদিন দেখা যাবে?', 'Most full courses give you access for up to 2 years — long enough to revise before your professional exam. Check each course page for exact duration.', 'বেশিরভাগ ফুল কোর্সে ২ বছর পর্যন্ত অ্যাক্সেস থাকে — প্রফের আগে রিভিশন দেওয়ার জন্য যথেষ্ট সময়। কোন কোর্সের মেয়াদ কত, সেটা কোর্স পেজেই লেখা আছে।', 30),
  ('Can I watch on my phone?', 'মোবাইল থেকে ক্লাস করা যাবে?', 'Yes. The platform is website-based and works on any phone, tablet or laptop browser — no app install needed. Bookmarking lets you jump back to where you left off.', 'অবশ্যই। কোনো অ্যাপ নামাতে হবে না — ফোন, ট্যাব বা ল্যাপটপের ব্রাউজার থেকেই চলবে। বুকমার্ক করে রাখলে যেখানে থেমেছিলে, পরে ঠিক সেখান থেকেই শুরু করতে পারবে।', 40),
  ('Do you offer free classes?', 'ফ্রি ক্লাস আছে?', 'Yes — 100+ free classes are on our YouTube channel. Subscribe to [@mediversedental](https://youtube.com/@mediversedental?si=VuCm4kPuqcdEORaJ) to get notified.', 'আছে! আমাদের ইউটিউব চ্যানেলে ১০০+ ফ্রি ক্লাস আছে। নতুন ক্লাসের আপডেট পেতে [@mediversedental](https://youtube.com/@mediversedental?si=VuCm4kPuqcdEORaJ) সাবস্ক্রাইব করে রাখো।', 50);

insert into public.testimonials (quote_en, quote_bn, attribution_en, attribution_bn, source_en, source_bn, sort_order) values
  ('The SDM notes were exactly what came in my viva. I didn''t need any other book that term.', 'SDM-এর নোটসে যা ছিল, ভাইভায় হুবহু সেগুলোই ধরেছে। ওই টার্মে আর অন্য কোনো বই খুলতেই হয়নি।', '3rd Prof student', 'থার্ড প্রফের স্টুডেন্ট', 'Dhaka Dental College', 'ঢাকা ডেন্টাল কলেজ', 10),
  ('Having a mentor actually reply to my questions changed how I studied for finals.', 'প্রশ্ন করলে মেন্টর সত্যি সত্যিই উত্তর দিতেন — ফাইনালের আগে আমার পড়ার ধরনটাই বদলে গেছে।', '4th Prof student', 'ফোর্থ প্রফের স্টুডেন্ট', 'Chattagram Dental College', 'চট্টগ্রাম ডেন্টাল কলেজ', 20),
  ('The OMS case book format matches the exam so closely it felt like practice runs.', 'OMS কেস বুকের ফরম্যাট পরীক্ষার সাথে এত মিলে যায় যে মনে হচ্ছিল আগেই একবার পরীক্ষা দিয়ে ফেলেছি।', 'Final Prof student', 'ফাইনাল প্রফের স্টুডেন্ট', 'BDS, Bangladesh', 'BDS, বাংলাদেশ', 30);

insert into public.nav_items (location, label_en, label_bn, url, is_external, open_new_tab, style, sort_order) values
  ('header', 'About', 'আমাদের কথা', '#about', false, false, 'link', 10),
  ('header', 'Courses', 'কোর্স', '#courses', false, false, 'link', 20),
  ('header', 'Mentors', 'মেন্টর', '#mentors', false, false, 'link', 30),
  ('header', 'Stories', 'রিভিউ', '#stories', false, false, 'link', 40),
  ('header', 'FAQ', 'প্রশ্ন-উত্তর', '#faq', false, false, 'link', 50),
  ('header', 'Enroll Now', 'এনরোল করো', 'https://mediversebd.com', true, true, 'button', 60),
  ('mobile', 'Home', 'হোম', '#top', false, false, 'link', 10),
  ('mobile', 'About MediVerse', 'মেডিভার্স সম্পর্কে', '#about', false, false, 'link', 20),
  ('mobile', 'Courses', 'কোর্স', '#courses', false, false, 'link', 30),
  ('mobile', 'Mentor Panel', 'মেন্টর প্যানেল', '#mentors', false, false, 'link', 40),
  ('mobile', 'Student Stories', 'স্টুডেন্টদের রিভিউ', '#stories', false, false, 'link', 50),
  ('mobile', 'FAQ & Contact', 'প্রশ্ন-উত্তর ও যোগাযোগ', '#faq', false, false, 'link', 60),
  ('mobile', 'Enroll at mediversebd.com', 'mediversebd.com-এ এনরোল করো', 'https://mediversebd.com', true, true, 'button', 70);

insert into public.footer_sections (type, title_en, title_bn, body_en, body_bn, sort_order) values
  ('text', null, null, 'Future Dentistry Begins Here. A BDS education platform guided by expert mentors — phase-wise courses, mentor guidance and exam-focused notes for students across Bangladesh.', 'ডেন্টিস্ট্রির ভবিষ্যৎ শুরু এখান থেকেই। এক্সপার্ট মেন্টরদের হাতে গড়া BDS পড়াশোনার প্ল্যাটফর্ম — সারা দেশের স্টুডেন্টদের জন্য ফেজ অনুযায়ী কোর্স, মেন্টরের গাইডলাইন আর পরীক্ষার নোটস।', 10),
  ('links', 'Courses', 'কোর্স', null, null, 20),
  ('links', 'Explore', 'ঘুরে দেখো', null, null, 30),
  ('links', 'Platform', 'প্ল্যাটফর্ম', null, null, 40);

insert into public.footer_links (section_id, label_en, label_bn, url, is_external, sort_order) values
  ((select id from public.footer_sections where title_en = 'Courses'), '1st Phase', '১ম ফেজ', '#phase-1', false, 10),
  ((select id from public.footer_sections where title_en = 'Courses'), '2nd Phase', '২য় ফেজ', '#phase-2', false, 20),
  ((select id from public.footer_sections where title_en = 'Courses'), '3rd Phase', '৩য় ফেজ', '#phase-3', false, 30),
  ((select id from public.footer_sections where title_en = 'Courses'), 'Final Phase', 'ফাইনাল ফেজ', '#phase-4', false, 40),
  ((select id from public.footer_sections where title_en = 'Explore'), 'About', 'আমাদের কথা', '#about', false, 10),
  ((select id from public.footer_sections where title_en = 'Explore'), 'Mentor Panel', 'মেন্টর প্যানেল', '#mentors', false, 20),
  ((select id from public.footer_sections where title_en = 'Explore'), 'Student Stories', 'স্টুডেন্টদের রিভিউ', '#stories', false, 30),
  ((select id from public.footer_sections where title_en = 'Explore'), 'FAQ', 'প্রশ্ন-উত্তর', '#faq', false, 40),
  ((select id from public.footer_sections where title_en = 'Platform'), 'mediversebd.com', 'mediversebd.com', 'https://mediversebd.com', true, 10),
  ((select id from public.footer_sections where title_en = 'Platform'), 'Contact', 'যোগাযোগ', '#contact', false, 20),
  ((select id from public.footer_sections where title_en = 'Platform'), 'Privacy Policy', 'প্রাইভেসি পলিসি', 'https://mediversebd.com', true, 30),
  ((select id from public.footer_sections where title_en = 'Platform'), 'Terms of Service', 'শর্তাবলি', 'https://mediversebd.com', true, 40);

insert into public.social_links (platform, url, label_en, label_bn, subtitle_en, subtitle_bn, sort_order) values
  ('facebook', 'https://www.facebook.com/share/18R8eQDysQ/', 'Facebook', 'Facebook', 'Updates & community', 'আপডেট আর কমিউনিটি', 10),
  ('youtube', 'https://youtube.com/@mediversedental?si=VuCm4kPuqcdEORaJ', 'YouTube', 'YouTube', '100+ free classes', '১০০+ ফ্রি ক্লাস', 20),
  ('telegram', 'https://t.me/mvdental', 'Telegram', 'Telegram', 'Notes & notices', 'নোটস আর নোটিশ', 30),
  ('whatsapp', 'https://wa.me/8801726415926?text=Hello%20MediVerse%20Dental%2C%20I%20would%20like%20to%20know%20more%20about%20your%20BDS%20courses.', 'WhatsApp', 'WhatsApp', '+880 1726-415926', '+880 1726-415926', 40);

-- >>>>>>>>>>>>>>>>>>>> self-check >>>>>>>>>>>>>>>>>>>>
-- If anything is missing, stop here and roll everything back.
do $$
declare
  v_courses int := (select count(*) from public.courses);
  v_mentors int := (select count(*) from public.mentors);
  v_media   int := (select count(*) from public.media);
  v_bucket  int := (select count(*) from storage.buckets where id = 'public-media');
  v_no_rls  int := (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity);
begin
  if v_courses <> 22 or v_mentors <> 10 or v_media <> 29 or v_bucket <> 1 or v_no_rls <> 0 then
    raise exception 'Setup self-check failed: courses=%, mentors=%, media=%, bucket=%, tables_without_rls=% — nothing was saved',
      v_courses, v_mentors, v_media, v_bucket, v_no_rls;
  end if;
end;
$$;

commit;

-- Result shown in the SQL Editor (expected: 22 | 10 | 29 | 7 | 1 | 0)
select
  (select count(*) from public.courses)        as courses,
  (select count(*) from public.mentors)        as mentors,
  (select count(*) from public.media)          as images,
  (select count(*) from public.page_sections)  as homepage_sections,
  (select count(*) from storage.buckets where id = 'public-media') as image_bucket,
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as tables_without_protection;
