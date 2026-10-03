"""Generate supabase/seed.sql from the CURRENT website source.

The live site's content lives in src/build.py (courses, mentors), src/template.html
(homepage copy) and src/i18n_bn.py (Bangla). This script turns that into SQL so
the CMS starts with exactly what the site shows today.

    python3 mediverse-dental/supabase/seed/generate_seed.py

Image FILES are not uploaded here — media rows point at deterministic storage
paths (e.g. flyers/sdm-full.jpg). A later phase's upload script puts each file
from assets/ at that same path in the "public-media" bucket.
"""
import hashlib
import json
import pathlib
import re
import struct
import sys

SEED_DIR = pathlib.Path(__file__).resolve().parent
ROOT = SEED_DIR.parent.parent                    # mediverse-dental/
sys.path.insert(0, str(ROOT / "src"))
sys.dont_write_bytecode = True

import build    # noqa: E402  (current site data)
import i18n_bn  # noqa: E402

OUT = SEED_DIR.parent / "seed.sql"
ASSETS = ROOT / "assets"
BN = dict(i18n_bn.PAGE)
WA_URL = build.WA


# ---------------------------------------------------------------- helpers --
def bn(en):
    """Bangla for an English page string; fails loudly if missing."""
    if en not in BN:
        raise KeyError(f"No Bangla translation for: {en!r}")
    return BN[en]


def q(v):
    """SQL literal."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def arr(values):
    return "array[" + ", ".join(q(v) for v in values) + "]::text[]" if values else "'{}'::text[]"


def to_markup(html):
    """Convert the template's tiny bits of HTML to the CMS's safe markup."""
    s = html.replace("<br>", "\\n")
    s = re.sub(r'<span class="grad-text">(.*?)</span>', r"[[\1]]", s)
    s = re.sub(r'<a href="([^"]+)"[^>]*>(.*?)</a>', r"[\2](\1)", s)
    s = s.replace("<i></i>", "").replace("&amp;", "&")
    s = re.sub(r"<b>(.*?)</b>", r"**\1**", s)          # bold → **bold**
    if "<" in s:
        raise ValueError(f"Unconverted HTML left in: {s!r}")
    return s.replace("\\n", "\n")


def t(en_html):
    """{en, bn} pair in CMS markup, from an English template string."""
    return {"en": to_markup(en_html), "bn": to_markup(bn(en_html))}


def slugify(s):
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-+", "-", s)


def image_size(path):
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", data[16:24])
        return w, h
    i = 2  # JPEG: walk segments to the SOF marker
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker == 0xFF:                       # fill byte
            i += 1
            continue
        if marker in (0x01, 0xD8) or 0xD0 <= marker <= 0xD7:   # markers without a length
            i += 2
            continue
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        i += 2 + seg_len
    raise ValueError(f"Cannot read image size: {path}")


def insert(table, rows):
    if not rows:
        return ""
    cols = list(rows[0].keys())
    lines = [f"insert into public.{table} ({', '.join(cols)}) values"]
    vals = []
    for r in rows:
        vals.append("  (" + ", ".join(r[c] if isinstance(r[c], Raw) else q(r[c]) for c in cols) + ")")
    return "\n".join(lines) + "\n" + ",\n".join(vals) + ";\n\n"


class Raw(str):
    """Pre-rendered SQL expression."""


def media_ref(path):
    return Raw(f"(select id from public.media where path = {q(path)})") if path else None


# ------------------------------------------------------------------ media --
KIND_FOLDER = {"flyer": "flyers", "mentor_photo": "mentors", "logo": "logos"}
media_rows, media_path_for = [], {}


def add_media(filename, kind, alt_en, alt_bn=None):
    p = ASSETS / filename
    folder = KIND_FOLDER[kind]
    storage_path = f"{folder}/{filename}"
    w, h = image_size(p)
    data = p.read_bytes()
    media_rows.append({
        "path": storage_path, "kind": kind,
        "mime": "image/png" if filename.endswith(".png") else "image/jpeg",
        "size_bytes": len(data), "width": w, "height": h,
        "alt_en": alt_en, "alt_bn": alt_bn,
        "sha256": hashlib.sha256(data).hexdigest(),
    })
    media_path_for[filename] = storage_path
    return storage_path


add_media("logo-white.png", "logo", "MediVerse Dental logo (white)")
add_media("logo-blue.png", "logo", "MediVerse Dental logo (blue)")
for c in build.COURSES:
    if c[3]:
        add_media(c[3], "flyer", f"{c[1]} course flyer")
for m in build.MENTORS:
    if m[3] not in (None, build.HIJAB):
        add_media(m[3], "mentor_photo", m[0])

# ---------------------------------------------------------- site settings --
site_settings = [{
    "site_name": "MediVerse Dental",
    "logo_dark_media_id": media_ref("logos/logo-white.png"),
    "logo_light_media_id": media_ref("logos/logo-blue.png"),
    "seo_title_en": "MediVerse Dental — Future Dentistry Begins Here",
    "seo_title_bn": i18n_bn.UI["title"],
    "seo_description_en": "MediVerse Dental — phase-wise BDS courses, expert mentors and exam-focused notes for dental students across Bangladesh.",
    "seo_description_bn": "ফেজ ধরে সাজানো BDS কোর্স, অভিজ্ঞ মেন্টর আর পরীক্ষার নোটস — বাংলাদেশের ডেন্টাল স্টুডেন্টদের জন্য।",
    "whatsapp_number": "+8801726415926",
    "whatsapp_message_en": "Hello MediVerse Dental, I would like to know more about your BDS courses.",
    "copyright_en": "MediVerse Dental. All rights reserved.",
    "copyright_bn": bn("MediVerse Dental. All rights reserved."),
    "footer_tagline_en": "Made for BDS students, by expert mentors 🦷",
    "footer_tagline_bn": bn("Made for BDS students, by expert mentors 🦷"),
    "primary_cta_url": "https://mediversebd.com",
}]

# ----------------------------------------------------------------- phases --
PHASE_SUMMARY = {
    1: "SDM, Dental Anatomy, Physiology, Biochemistry — the foundation, with diagram-heavy notes and viva prep.",
    2: "Pharmacology, Pathology, Microbiology — dense subjects distilled into exam-ready summaries.",
    3: "Oral Pathology &amp; Medicine, Periodontology, Medicine, Surgery — where clinical thinking takes shape.",
    4: "OMS, Conservative, Orthodontics, Prosthodontics, Pedodontics — mastery for finals.",
}
phases = []
for code, name in build.PHASE.items():
    code = int(code)
    phases.append({
        "code": code, "name_en": name, "name_bn": bn(name),
        "summary_en": to_markup(PHASE_SUMMARY[code]), "summary_bn": to_markup(bn(PHASE_SUMMARY[code])),
        "sort_order": code * 10,
    })

# ---------------------------------------------------------------- courses --
courses, slugs = [], set()
for i, (phase, title, desc, img, url, kw) in enumerate(build.COURSES):
    slug = slugify(title)
    assert slug not in slugs, slug
    slugs.add(slug)
    courses.append({
        "slug": slug,
        "title_en": title,
        "title_bn": None,                       # course names stay in English (site convention)
        "short_desc_en": desc,
        "short_desc_bn": i18n_bn.COURSE_DESC[desc],
        "phase_id": Raw(f"(select id from public.phases where code = {int(phase)})"),
        "flyer_media_id": media_ref(media_path_for.get(img)) if img else None,
        "external_url": url or "https://mediversebd.com",
        "cta_label_en": "Enroll on Mediverse",
        "cta_label_bn": "মেডিভার্সে এনরোল করো",
        "search_keywords": Raw(arr(kw.split())),
        "status": "active",
        "sort_order": (i + 1) * 10,
    })

# ---------------------------------------------------------------- mentors --
def split_credentials(cred):
    """'Pioneer Dental College (PDC), Session 2023-24.' → institution/session where obvious."""
    m = re.search(r"Session (\d{4}-\d{2})", cred)
    return (m.group(1) if m else None)


mentors, mentor_slug = [], {}
for i, (name, tag, cred, photo) in enumerate(build.MENTORS):
    slug = slugify(name.replace("Dr. ", ""))
    mentor_slug[name] = slug
    style = "hijab_icon" if photo == build.HIJAB else ("photo" if photo else "initials")
    mentors.append({
        "slug": slug, "name": name,
        "designation_en": tag, "designation_bn": None,
        "credentials": cred,
        "session": split_credentials(cred),
        "photo_media_id": media_ref(media_path_for.get(photo)) if style == "photo" else None,
        "avatar_style": style,
        "status": "active",
        "sort_order": (i + 1) * 10,
    })

# Mentor ↔ course links that are printed on the existing course flyers.
# (Other courses' mentors are not stated anywhere in the site source; assign them in the admin.)
FLYER_MENTORS = {
    "sdm-full-course": "Firoj Ahamed Fahim",
    "sdm-crash-course": "Firoj Ahamed Fahim",
    "dental-anatomy-full-course": "Firoj Ahamed Fahim",
    "anatomy-1st-term": "Sirajum Munir",
    "c-and-c-oral-patho-medicine-and-perio": "Dr. Tanim Ahmed",
    "crash-course-on-peri-and-oral-patho": "Dr. Tanim Ahmed",
    "essential-medicine-for-bds": "Dr. M R Sifat",
}
course_mentors = []
for cslug, mname in FLYER_MENTORS.items():
    assert cslug in slugs, cslug
    course_mentors.append({
        "course_id": Raw(f"(select id from public.courses where slug = {q(cslug)})"),
        "mentor_id": Raw(f"(select id from public.mentors where slug = {q(mentor_slug[mname])})"),
        "role": "lead",
    })

# ------------------------------------------------------- homepage sections --
def btn(label_en, url, style="primary", new_tab=False):
    return {"label_en": to_markup(label_en), "label_bn": to_markup(bn(label_en)),
            "url": url, "style": style, "new_tab": new_tab}


def section(key, order, fields, buttons=()):
    content = {"en": {k: v["en"] for k, v in fields.items()},
               "bn": {k: v["bn"] for k, v in fields.items()},
               "buttons": list(buttons)}
    return {"key": key, "sort_order": order, "is_visible": True, "content": content}


sections = [
    section("hero", 10, {
        "kicker": t("<i></i>BDS Education · Built for Bangladesh"),
        "heading": t('Future Dentistry<br><span class="grad-text">Begins Here.</span>'),
        "tagline": {"en": "ডেন্টাল শিক্ষার নতুন দিগন্ত", "bn": "ডেন্টাল শিক্ষার নতুন দিগন্ত"},
        "lead": t("Phase-wise BDS courses, expert mentors and exam-focused notes — everything a dental student in Bangladesh needs, on one modern platform."),
    }, [btn("Explore Courses", "#courses"), btn("Meet the Mentors", "#mentors", "ghost")]),
    section("about", 20, {
        "kicker": t("<i></i>About MediVerse Dental"),
        "heading": t('Dental education, <span class="grad-text">re-engineered</span> for how you actually study.'),
        "intro": t("MediVerse Dental is an academic platform built by expert mentors to help BDS students learn better, prepare smarter and access quality resources — wherever they are in Bangladesh."),
        "mission_heading": t("Our goal is simple — make quality dental education accessible, structured and easier to learn."),
        "mission_body": t("From 1st Prof SDM to Final Prof OMS, every course is mapped to the BDS curriculum and standard textbooks, taught by mentors who have sat the same exams you're preparing for."),
        "trust_line": t("Trusted by <b>4,700+ BDS students</b> from dental colleges nationwide"),
        "highlight_value": {"en": "25+", "bn": "২৫+"},
        "highlight_label": t("Courses covering every BDS professional phase"),
    }),
    section("courses", 30, {
        "kicker": t("<i></i>Courses"),
        "heading": t('Find the course for <span class="grad-text">your phase</span>.'),
        "intro": t("Filter by professional phase or search a subject — every course is built from board-relevant textbooks and exam patterns."),
        "search_placeholder": {"en": "Search e.g. OPG, Anatomy, Ortho…", "bn": i18n_bn.UI["search"]},
    }, [btn("See all courses on mediversebd.com", "https://mediversebd.com", "ghost", True)]),
    section("mentors", 40, {
        "kicker": t("<i></i>Expert Mentor Panel"),
        "heading": t('Learn from expert mentors who\'ve <span class="grad-text">sat where you\'re sitting</span>.'),
        "intro": t("15+ mentors from DMC, DDC, SSMC, MDCH, IMC and more — toppers, FCPS trainees and practising clinicians."),
    }),
    section("stories", 50, {
        "kicker": t("<i></i>Student stories"),
        "heading": t('What students say after <span class="grad-text">MediVerse</span>.'),
    }),
    section("faq", 60, {
        "kicker": t("<i></i>FAQ"),
        "heading": t('Questions? <span class="grad-text">Answered.</span>'),
        "intro": t("Can't find what you need? Message us on WhatsApp or Telegram — the MediVerse team usually replies within a few hours."),
    }),
    section("contact", 70, {
        "heading": t("Ready to study smarter this term?"),
        "body": t("Join thousands of BDS students already learning with MediVerse Dental. Talk to our team or jump straight into a course."),
    }, [btn("Start Learning", "https://mediversebd.com", "primary", True),
        btn("Chat on WhatsApp", WA_URL, "ghost", True)]),
]

STATS = [(4700, "Students reached"), (25, "Academic courses"), (15, "Expert mentors"), (100, "Free classes")]
stats = [{"value": v, "suffix": "+", "label_en": l, "label_bn": bn(l), "sort_order": (i + 1) * 10}
         for i, (v, l) in enumerate(STATS)]

FEATURES = [
    ("video", "Recorded + live classes", "Learn at your pace with HD recordings, then clear doubts in live sessions."),
    ("notes", "Exam-mapped notes", "Diagram-heavy class notes, viva prep and question practice built for BDS profs."),
    ("chat", "24/7 mentor support", "Chatbox support and a mentor panel that actually replies to your questions."),
]
features = [{"icon": ic, "title_en": ti, "title_bn": bn(ti), "body_en": bo, "body_bn": bn(bo), "sort_order": (i + 1) * 10}
            for i, (ic, ti, bo) in enumerate(FEATURES)]

A_SITE, A_YT = i18n_bn.A_SITE, i18n_bn.A_YT
FAQS = [
    ("How do I enroll in a course?",
     f"Open the course page on {A_SITE}, tap Enroll and complete payment (bKash / Nagad / card). You get access in your dashboard right away."),
    ("Are classes live or recorded?",
     "Both. Core lectures are recorded so you can study at your own pace; live sessions and doubt-clearing classes are announced on our Facebook group and Telegram channel."),
    ("How long do I keep access?",
     "Most full courses give you access for up to 2 years — long enough to revise before your professional exam. Check each course page for exact duration."),
    ("Can I watch on my phone?",
     "Yes. The platform is website-based and works on any phone, tablet or laptop browser — no app install needed. Bookmarking lets you jump back to where you left off."),
    ("Do you offer free classes?",
     f"Yes — 100+ free classes are on our YouTube channel. Subscribe to {A_YT} to get notified."),
]
faqs = [{"question_en": qq, "question_bn": bn(qq), "answer_en": to_markup(a), "answer_bn": to_markup(bn(a)),
         "sort_order": (i + 1) * 10} for i, (qq, a) in enumerate(FAQS)]

TESTIMONIALS = [
    ("The SDM notes were exactly what came in my viva. I didn't need any other book that term.", "3rd Prof student", "Dhaka Dental College"),
    ("Having a mentor actually reply to my questions changed how I studied for finals.", "4th Prof student", "Chattagram Dental College"),
    ("The OMS case book format matches the exam so closely it felt like practice runs.", "Final Prof student", "BDS, Bangladesh"),
]
testimonials = []
for i, (qt, who, src) in enumerate(TESTIMONIALS):
    who_bn, src_bn = re.match(r'<b[^>]*>(.*?)</b><br>(.*)', bn(f'<b style="color:var(--ink)">{who}</b><br>{src}')).groups()
    testimonials.append({"quote_en": qt, "quote_bn": bn(qt), "attribution_en": who, "attribution_bn": who_bn,
                         "source_en": src, "source_bn": src_bn, "sort_order": (i + 1) * 10})

# --------------------------------------------------------- header & footer --
def nav(location, label, url, order, style="link", external=False):
    return {"location": location, "label_en": label, "label_bn": to_markup(bn(label)), "url": url,
            "is_external": external, "open_new_tab": external, "style": style, "sort_order": order}


nav_items = [
    nav("header", "About", "#about", 10), nav("header", "Courses", "#courses", 20),
    nav("header", "Mentors", "#mentors", 30), nav("header", "Stories", "#stories", 40),
    nav("header", "FAQ", "#faq", 50),
    nav("header", "Enroll Now", "https://mediversebd.com", 60, "button", True),
    nav("mobile", "Home", "#top", 10), nav("mobile", "About MediVerse", "#about", 20),
    nav("mobile", "Courses", "#courses", 30), nav("mobile", "Mentor Panel", "#mentors", 40),
    nav("mobile", "Student Stories", "#stories", 50), nav("mobile", "FAQ &amp; Contact", "#faq", 60),
    nav("mobile", "Enroll at mediversebd.com", "https://mediversebd.com", 70, "button", True),
]
for n in nav_items:
    n["label_en"] = to_markup(n["label_en"])

BLURB = ("Future Dentistry Begins Here. A BDS education platform guided by expert mentors — phase-wise courses, "
         "mentor guidance and exam-focused notes for students across Bangladesh.")
footer_sections = [
    {"type": "text", "title_en": None, "title_bn": None, "body_en": BLURB, "body_bn": bn(BLURB), "sort_order": 10},
    {"type": "links", "title_en": "Courses", "title_bn": bn("Courses"), "body_en": None, "body_bn": None, "sort_order": 20},
    {"type": "links", "title_en": "Explore", "title_bn": bn("Explore"), "body_en": None, "body_bn": None, "sort_order": 30},
    {"type": "links", "title_en": "Platform", "title_bn": bn("Platform"), "body_en": None, "body_bn": None, "sort_order": 40},
]


def flink(section_title, label, url, order, external=False, label_bn=None):
    return {"section_id": Raw(f"(select id from public.footer_sections where title_en = {q(section_title)})"),
            "label_en": label, "label_bn": label_bn if label_bn is not None else bn(label),
            "url": url, "is_external": external, "sort_order": order}


# "#phase-N" anchors tell the renderer to scroll to courses and apply that phase filter.
footer_links = [
    flink("Courses", "1st Phase", "#phase-1", 10), flink("Courses", "2nd Phase", "#phase-2", 20),
    flink("Courses", "3rd Phase", "#phase-3", 30), flink("Courses", "Final Phase", "#phase-4", 40),
    flink("Explore", "About", "#about", 10), flink("Explore", "Mentor Panel", "#mentors", 20),
    flink("Explore", "Student Stories", "#stories", 30), flink("Explore", "FAQ", "#faq", 40),
    flink("Platform", "mediversebd.com", "https://mediversebd.com", 10, True, "mediversebd.com"),
    flink("Platform", "Contact", "#contact", 20),
    flink("Platform", "Privacy Policy", "https://mediversebd.com", 30, True),
    flink("Platform", "Terms of Service", "https://mediversebd.com", 40, True),
]

social_links = [
    {"platform": "facebook", "url": "https://www.facebook.com/share/18R8eQDysQ/", "label_en": "Facebook", "label_bn": "Facebook",
     "subtitle_en": "Updates & community", "subtitle_bn": to_markup(bn("Updates &amp; community")), "sort_order": 10},
    {"platform": "youtube", "url": "https://youtube.com/@mediversedental?si=VuCm4kPuqcdEORaJ", "label_en": "YouTube", "label_bn": "YouTube",
     "subtitle_en": "100+ free classes", "subtitle_bn": bn("100+ free classes"), "sort_order": 20},
    {"platform": "telegram", "url": "https://t.me/mvdental", "label_en": "Telegram", "label_bn": "Telegram",
     "subtitle_en": "Notes & notices", "subtitle_bn": to_markup(bn("Notes &amp; notices")), "sort_order": 30},
    {"platform": "whatsapp", "url": WA_URL, "label_en": "WhatsApp", "label_bn": "WhatsApp",
     "subtitle_en": "+880 1726-415926", "subtitle_bn": "+880 1726-415926", "sort_order": 40},
]

# ------------------------------------------------------------------ write --
sql = [
    "-- ============================================================================\n",
    "-- MediVerse Dental CMS — seed data (GENERATED, do not edit by hand)\n",
    "-- Source: src/build.py, src/template.html, src/i18n_bn.py, assets/\n",
    "-- Regenerate: python3 mediverse-dental/supabase/seed/generate_seed.py\n",
    "-- Idempotent only on an empty database (run after `supabase db reset`).\n",
    "-- ============================================================================\n\n",
    "begin;\n\n",
    insert("media", media_rows),
    insert("site_settings", site_settings),
    insert("phases", phases),
    insert("courses", courses),
    insert("mentors", mentors),
    insert("course_mentors", course_mentors),
    insert("page_sections", sections),
    insert("stats", stats),
    insert("features", features),
    insert("faqs", faqs),
    insert("testimonials", testimonials),
    insert("nav_items", nav_items),
    insert("footer_sections", footer_sections),
    insert("footer_links", footer_links),
    insert("social_links", social_links),
    "commit;\n",
]
OUT.write_text("".join(sql), encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT.parent)}: {len(media_rows)} media, {len(courses)} courses, "
      f"{len(mentors)} mentors, {len(course_mentors)} course-mentor links, {len(sections)} sections, "
      f"{len(nav_items)} nav items, {len(footer_links)} footer links")
