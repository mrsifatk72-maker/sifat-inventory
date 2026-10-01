"""Build a single self-contained index.html for the MediVerse Dental landing page.

Images live in ./assets and are inlined as data URIs so the output is one file
you can upload anywhere (mediversebd.com, Netlify, GitHub Pages, etc.).

    python3 mediverse-dental/src/build.py
"""
import base64
import json
import html
import mimetypes
import pathlib

import i18n_bn

SRC = pathlib.Path(__file__).parent
ROOT = SRC.parent
ASSETS = ROOT / "assets"
OUT = ROOT / "index.html"

WA = ("https://wa.me/8801726415926?text=Hello%20MediVerse%20Dental%2C%20I%20would%20like"
      "%20to%20know%20more%20about%20your%20BDS%20courses.")
SITE = "https://mediversebd.com"
C = SITE + "/courses/"

SVG = {
    "FB": '<svg viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.07C24 5.4 18.6 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>',
    "YT": '<svg viewBox="0 0 24 24"><path fill="#FF0000" d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.51 3.5 12 3.5 12 3.5s-7.51 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14C4.49 20.5 12 20.5 12 20.5s7.51 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81z"/><path fill="#fff" d="M9.6 15.6V8.4L15.8 12z"/></svg>',
    "TG": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#26A5E4"/><path fill="#fff" d="M17.94 7.06 15.7 17.6c-.17.75-.62.94-1.25.58l-3.46-2.55-1.67 1.6c-.18.18-.34.34-.7.34l.25-3.53 6.43-5.8c.28-.25-.06-.39-.43-.14L6.4 12.36l-3.47-1.08c-.75-.24-.77-.75.16-1.11L16.8 5.68c.63-.23 1.18.15.97 1.38z"/></svg>',
    "WA": '<svg viewBox="0 0 24 24"><path fill="#25D366" d="M12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.11 1.52 5.84L0 24l6.32-1.48A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/><path fill="#fff" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.05 1.02-1.05 2.5 1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/></svg>',
}

PHASE = {"1": "1st Phase", "2": "2nd Phase", "3": "3rd Phase", "4": "Final Phase"}

# (phase, title, description, image file or None, url or None, extra search keywords)
COURSES = [
    ("1", "SDM Full Course", "Complete Science of Dental Materials, exam-mapped from the start.", "sdm-full.jpg", C + "science-of-dental-materials-full-course", "science of dental materials"),
    ("1", "SDM Crash Course", "A fast, exam-focused refresher covering SDM's high-yield topics.", "sdm-crash.jpg", C + "sdm-crash-course", "science of dental materials revision"),
    ("1", "Dental Anatomy Full Course", "Tooth morphology through full arch relations and occlusion.", "dental-anatomy.jpg", C + "dental-anatomy-full-course", "da tooth morphology"),
    ("1", "Anatomy 1st Term", "Foundational general anatomy, structured for early BDS.", "anatomy-1.jpg", C + "anatomy-first-term-for-bds", "general anatomy"),
    ("1", "Anatomy 2nd Term", "Continues core anatomy with viva-focused revision notes.", "anatomy-2.jpg", C + "anatomy-second-term-for-bds", "general anatomy"),
    ("1", "Dental Morphology", "Tooth form and function, mapped for practical and theory exams.", "dental-morphology.jpg", None, "tooth anatomy"),
    ("1", "Essential Physiology", "Systems-based physiology notes built for BDS first phase.", "physiology.jpg", C + "essential-physiology-for-bds", ""),
    ("1", "Essential Biochemistry", "Core biochemical concepts, simplified for dental students.", "biochemistry.jpg", C + "essential-biochemistry-for-bds", ""),
    ("2", "Dental Pharmacology", "Drug classes and dental prescriptions, exam-focused.", "dental-pharmacology.jpg", C + "dental-pharmacology", "drugs prescription"),
    ("2", "Essential Pathology for BDS", "Concept-first notes on inflammation, neoplasia and healing.", "pathology.jpg", C + "essential-pathology-for-bds", "general pathology"),
    ("2", "Microbiology", "Organism-wise notes built around board-relevant clinical links.", "microbiology.jpg", C + "microbiology-full-course", "micro"),
    ("2", "Pharmacology", "General pharmacology principles ahead of dental applications.", "pharmacology.jpg", C + "pharmacology-full-course", "drugs"),
    ("3", "C&C — Oral Patho, Medicine & Perio", "Combined Oral Pathology, Oral Medicine and Periodontology.", "cc-batch.jpg", C + "cawson-carranza", "cawson carranza oral pathology periodontology"),
    ("3", "Crash Course on Peri & Oral Patho", "Question-based rapid revision of Periodontology and Oral Pathology for written and viva.", "peri-oral-crash.jpg", C + "crash-course-on-peri-oral-patho", "cawson carranza perio periodontology oral pathology crash revision"),
    ("3", "Essential Medicine for BDS", "Core general medicine concepts relevant to dental practice and exams.", "medicine.jpg", C + "essential-medicine-for-bds", "general medicine"),
    ("3", "A Complete Solution of Surgery", "Full prep for Surgery Paper I — written, viva, OSPE, long and short cases.", "surgery.jpg", C + "a-complete-solution-of-surgery", "general surgery ospe long case short case"),
    ("4", "Mastering Maxillofacial Surgery", "OMS concepts through to exam-format short and long cases.", "oms.jpg", C + "maxillofacial-surgery", "oms oral surgery"),
    ("4", "Conservative & Endo Core Course", "Cavity classification through endodontic protocols, simplified.", "conservative.jpg", C + "conservative-endodontics", "endodontics operative"),
    ("4", "Orthodontics Made Easy", "Core orthodontic concepts distilled for finals revision.", "orthodontics.jpg", C + "orthodontics-made-easy", "ortho"),
    ("4", "Decode the OPG", "Step-by-step OPG, PNS and OM view interpretation with real cases.", "decode-opg.jpg", C + "decode-the-opg", "radiology x-ray opg"),
    ("4", "Prosthodontics Made Easy", "Removable and fixed prosthodontics, exam-focused summaries.", "prosthodontics.jpg", C + "prosthodontics-made-easy", "prostho denture"),
    ("4", "Pedodontics Made Easy", "Child dental care and management, simplified for finals.", None, None, "paediatric pediatric children"),
]

# (name, subject tag, credentials, photo or None) — all mentors shown equally
MENTORS = [
    ("Dr. Tanim Ahmed", "Oral Patho · Perio · OMS · Conservative", "MDCH, Session 2018-19. Expertise: Oral Pathology & Medicine, Periodontology, Oral & Maxillofacial Surgery, Conservative & Endodontics.", "tanim.jpg"),
    ("Dr. M R Sifat", "Medicine", "MBBS (DMC), BCS (Health), FCPS P-1 (Medicine), MRCP P-2 (UK). DMC, Session 2014-15.", "sifat.jpg"),
    ("Firoj Ahamed Fahim", "SDM & Dental Anatomy", "Final year BDS, Sir Salimullah Medical College (Dental Unit), Session 2021-22.", "fahim.jpg"),
    ("Sirajum Munir", "General Anatomy", "Pioneer Dental College (PDC), Session 2023-24.", "munir.jpg"),
    ("Khondkar Adlul Haque", "Biochemistry", "Pioneer Dental College (PDC), Session 2023-24.", "adlul.jpg"),
    ("Nusrat Jahan Efty", "Dental Pharmacology", "Sir Salimullah Medical College, Session 2021-22.", None),
    ("Dr. Mahmudul Hasan Siyam", "Prosthodontics", "SSMC, DU. Session 2018-19.", "siyam.jpg"),
    ("Dr. Faiza Tabassum", "Orthodontics", "FCPS Part II Trainee (Dhaka Dental College), Session 2017-18. 3rd in BDS Final Prof (DU). Honours in OMS, Orthodontics, Prosthodontics, Conservative, General Surgery and Dental Anatomy.", None),
    ("Dr. Taslima Jahan Lubna", "Orthodontics", "Marks Dental College, Session 2010-11. Pursuing MFDS RCSEng Part-1 and FCPS Part-1 (Orthodontics).", None),
    ("Dr. Jannatul Ferdous", "Conservative & Endo", "IMC, Session 2014-15. MS at BMU (Conservative Dentistry & Endodontics). Honours in Dental Public Health and Medicine.", None),
]

ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')


def data_uri(name):
    p = ASSETS / name
    mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def e(s):
    return html.escape(s, quote=True)


def course_html(phase, title, desc, img, url, kw):
    if img:
        media = f'<img src="{data_uri(img)}" alt="{e(title)} course flyer" loading="lazy" decoding="async">'
    else:
        media = f'<div class="ph"><div><b>{e(title)}</b><small>Coming soon</small></div></div>'
    href = url or SITE
    return (f'      <a class="course rv" data-f="{phase}" data-k="{e(kw.lower())}" href="{href}" target="_blank" rel="noopener">'
            f'<div class="c-img">{media}<span class="badge">{PHASE[phase]}</span></div>'
            f'<div class="c-body"><h3>{e(title)}</h3><p>{e(desc)}</p>'
            f'<span class="c-link"><span>View course</span> {ARROW}</span></div></a>')


def initials(name):
    parts = [w for w in name.replace("Dr.", "").split() if w[0].isalpha()]
    return (parts[0][0] + parts[-1][0]).upper()


def mentor_html(name, tag, cred, photo):
    media = (f'<img src="{data_uri(photo)}" alt="{e(name)}" loading="lazy" decoding="async">' if photo
             else f'<div class="mono" aria-hidden="true"><span>{initials(name)}</span></div>')
    return (f'      <article class="mentor rv" tabindex="0">{media}'
            f'<button class="more" aria-label="Show credentials of {e(name)}" aria-expanded="false">i</button>'
            f'<div class="info"><span class="tag">{e(tag)}</span><h3>{e(name)}</h3><p>{e(cred)}</p></div></article>')


def add_bangla(page):
    """Tag every element whose content matches an English string with data-i18n,
    and embed the Bangla dictionary for the language switch."""
    body_start, script_start = page.index("<body>"), page.index("<script>")
    body = page[body_start:script_start]
    pairs = list(i18n_bn.PAGE) + [(e(en), e(bn)) for en, bn in i18n_bn.COURSE_DESC.items()]
    bn = {"_title": i18n_bn.UI["title"], "_search": i18n_bn.UI["search"]}
    for i, (en, tr) in enumerate(pairs):
        key, needle, hits, pos = f"t{i}", ">" + en + "</", [], 0
        while (pos := body.find(needle, pos)) != -1:
            lt = body.rfind("<", 0, pos)
            tag = body[lt:pos]
            if not tag.startswith(("</", "<br")) and "data-i18n=" not in tag:
                hits.append(pos)
            pos += 1
        assert hits, f"Bangla translation has no matching English text: {en!r}"
        for pos in reversed(hits):
            body = body[:pos] + f' data-i18n="{key}"' + body[pos:]
        bn[key] = tr
    page = page[:body_start] + body + page[script_start:]
    return page.replace("{{BN_JSON}}", json.dumps(bn, ensure_ascii=False).replace("</", "<\\/"))


def main():
    out = (SRC / "template.html").read_text()
    out = out.replace("{{COURSES}}", "\n".join(course_html(*c) for c in COURSES))
    out = out.replace("{{MENTORS}}", "\n".join(mentor_html(*m) for m in MENTORS))
    out = out.replace("{{IMG:LOGO_WHITE}}", data_uri("logo-white.png"))
    out = out.replace("{{IMG:LOGO_BLUE}}", data_uri("logo-blue.png"))
    for k, v in SVG.items():
        out = out.replace("{{SVG:%s}}" % k, v)
    out = out.replace("{{WA}}", WA)
    out = add_bangla(out)
    assert "{{" not in out, "unreplaced placeholder"
    OUT.write_text(out)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
