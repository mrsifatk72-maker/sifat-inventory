import { useState, useRef, useCallback, useEffect } from "react";

const STEPS = ["upload", "processing", "select", "export"];

const STEP_LABELS = {
  upload: "Upload Photos",
  processing: "AI Scanning",
  select: "Select Data",
  export: "Export",
};

// Utility: Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ── STEP INDICATOR ──
function StepIndicator({ current }) {
  const idx = STEPS.indexOf(current);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, margin: "0 auto 32px", maxWidth: 520 }}>
      {STEPS.map((step, i) => (
        <div key={step} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", minWidth: 64,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: i <= idx ? "linear-gradient(135deg, #0d9488, #0f766e)" : "var(--bg-tertiary, #e5e7eb)",
              color: i <= idx ? "#fff" : "var(--text-tertiary, #9ca3af)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 15, fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.4s ease",
              boxShadow: i === idx ? "0 0 0 4px rgba(13,148,136,0.18)" : "none",
            }}>
              {i < idx ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 11, marginTop: 6, fontWeight: i === idx ? 700 : 500,
              color: i <= idx ? "var(--text-primary, #111)" : "var(--text-tertiary, #9ca3af)",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}>{STEP_LABELS[step]}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 3, borderRadius: 2, margin: "0 4px", marginBottom: 20,
              background: i < idx ? "#0d9488" : "var(--bg-tertiary, #e5e7eb)",
              transition: "background 0.4s ease",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── UPLOAD STEP ──
function UploadStep({ files, setFiles, onNext }) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setFiles(prev => {
      const combined = [...prev, ...imageFiles];
      return combined.slice(0, 10);
    });
  }, [setFiles]);

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <div style={{ animation: "fadeUp 0.5s ease" }}>
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2.5px dashed ${dragOver ? "#0d9488" : "var(--border-secondary, #d1d5db)"}`,
          borderRadius: 18, padding: "48px 24px", textAlign: "center",
          cursor: "pointer", transition: "all 0.3s ease",
          background: dragOver ? "rgba(13,148,136,0.06)" : "var(--bg-secondary, #f9fafb)",
          marginBottom: 24,
        }}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
        <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "var(--text-primary, #111)", marginBottom: 6 }}>
          Drag & drop your photos here
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--text-secondary, #6b7280)" }}>
          or <span style={{ color: "#0d9488", fontWeight: 600, textDecoration: "underline" }}>click to browse</span> • Up to 10 images • JPG, PNG, WEBP
        </div>
      </div>

      {/* Preview Grid */}
      {files.length > 0 && (
        <>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--text-primary, #111)", marginBottom: 12 }}>
            {files.length} photo{files.length > 1 ? "s" : ""} ready
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 12, marginBottom: 28 }}>
            {files.map((f, i) => (
              <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1", background: "#e5e7eb" }}>
                <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} style={{
                  position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer",
                  fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}>×</button>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 6px 5px",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
                  fontSize: 10, color: "#fff", fontFamily: "'DM Sans', sans-serif",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{f.name}</div>
              </div>
            ))}
          </div>
          <button onClick={onNext} style={{
            width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
            cursor: "pointer", transition: "transform 0.15s", boxShadow: "0 4px 16px rgba(13,148,136,0.25)",
          }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          >
            🔍 Start AI Scanning →
          </button>
        </>
      )}
    </div>
  );
}

// ── PROCESSING STEP ──
function ProcessingStep({ files, onDone }) {
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(0);
  const [status, setStatus] = useState("Preparing...");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function processAll() {
      const allResults = [];

      for (let i = 0; i < files.length; i++) {
        setCurrentFile(i);
        setStatus(`Scanning "${files[i].name}"...`);
        setProgress(Math.round(((i) / files.length) * 100));

        try {
          const base64 = await fileToBase64(files[i]);
          const mediaType = files[i].type || "image/jpeg";

          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4000,
              messages: [{
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: mediaType, data: base64 },
                  },
                  {
                    type: "text",
                    text: `You are a medical data extraction AI. Analyze this image thoroughly.

Extract ALL data you can find and return ONLY a valid JSON object (no markdown, no backticks, no explanation). Use this exact format:

{
  "image_type": "prescription | lab_report | patient_form | textbook | other",
  "title": "Brief description of what this image contains",
  "fields": [
    {"label": "Field Name", "value": "Extracted Value", "category": "category_name"}
  ]
}

Rules:
- Extract EVERY piece of text/data visible — names, dates, numbers, medications, dosages, values, reference ranges, everything.
- For prescriptions: extract patient name, doctor name, date, each medicine name, dose, frequency, duration, instructions.
- For lab reports: extract test name, result value, unit, reference range, status (normal/abnormal), date, patient info.
- For patient forms: extract all filled fields, checkboxes, demographics, vitals, diagnoses.
- For textbooks/guidelines: extract headings, key points, drug names, dosages, recommendations, criteria, classifications.
- Category can be: "patient_info", "medication", "lab_result", "vitals", "diagnosis", "clinical_info", "demographic", "other".
- Return ONLY the JSON. No other text.`
                  }
                ],
              }],
            }),
          });

          const data = await response.json();
          const text = data.content?.map(c => c.text || "").join("") || "";
          
          let parsed;
          try {
            const cleaned = text.replace(/```json|```/g, "").trim();
            parsed = JSON.parse(cleaned);
          } catch {
            parsed = {
              image_type: "other",
              title: files[i].name,
              fields: [{ label: "Raw Text", value: text.slice(0, 2000), category: "other" }],
            };
          }

          allResults.push({
            fileName: files[i].name,
            fileIndex: i,
            ...parsed,
          });

        } catch (err) {
          allResults.push({
            fileName: files[i].name,
            fileIndex: i,
            image_type: "error",
            title: `Error processing ${files[i].name}`,
            fields: [{ label: "Error", value: err.message, category: "other" }],
          });
        }

        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setStatus("Done!");
      setTimeout(() => onDone(allResults), 600);
    }

    processAll();
  }, [files, onDone]);

  return (
    <div style={{ textAlign: "center", padding: "40px 0", animation: "fadeUp 0.5s ease" }}>
      {/* Animated scanner icon */}
      <div style={{
        width: 88, height: 88, margin: "0 auto 24px", borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(13,148,136,0.12), rgba(13,148,136,0.04))",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pulse 1.8s ease-in-out infinite",
      }}>
        <span style={{ fontSize: 40 }}>🧠</span>
      </div>

      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary, #111)", marginBottom: 8 }}>
        AI is reading your photos...
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--text-secondary, #6b7280)", marginBottom: 24 }}>
        {status} ({currentFile + 1} of {files.length})
      </div>

      {/* Progress bar */}
      <div style={{ maxWidth: 360, margin: "0 auto", background: "var(--bg-tertiary, #e5e7eb)", borderRadius: 99, height: 10, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99,
          background: "linear-gradient(90deg, #0d9488, #14b8a6)",
          width: `${progress}%`, transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#0d9488", marginTop: 8 }}>{progress}%</div>
    </div>
  );
}

// ── SELECT STEP ──
function SelectStep({ results, selected, setSelected, onNext, onBack }) {
  const toggleField = (rIdx, fIdx) => {
    const key = `${rIdx}-${fIdx}`;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = (rIdx, fields) => {
    setSelected(prev => {
      const next = new Set(prev);
      const keys = fields.map((_, fi) => `${rIdx}-${fi}`);
      const allSelected = keys.every(k => next.has(k));
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const selectAllGlobal = () => {
    const all = new Set();
    results.forEach((r, ri) => r.fields?.forEach((_, fi) => all.add(`${ri}-${fi}`)));
    setSelected(all);
  };

  const deselectAll = () => setSelected(new Set());

  const totalFields = results.reduce((sum, r) => sum + (r.fields?.length || 0), 0);

  const TYPE_ICONS = {
    prescription: "💊", lab_report: "🧪", patient_form: "📋",
    textbook: "📖", other: "📄", error: "⚠️",
  };

  const CAT_COLORS = {
    patient_info: "#3b82f6", medication: "#ef4444", lab_result: "#8b5cf6",
    vitals: "#f59e0b", diagnosis: "#ec4899", clinical_info: "#0d9488",
    demographic: "#6366f1", other: "#6b7280",
  };

  return (
    <div style={{ animation: "fadeUp 0.5s ease" }}>
      {/* Header with select/deselect */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary, #111)" }}>
            {selected.size} of {totalFields} fields selected
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={selectAllGlobal} style={{
            padding: "6px 14px", borderRadius: 8, border: "1.5px solid #0d9488",
            background: "transparent", color: "#0d9488", fontWeight: 600, fontSize: 12,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Select All</button>
          <button onClick={deselectAll} style={{
            padding: "6px 14px", borderRadius: 8, border: "1.5px solid var(--border-secondary, #d1d5db)",
            background: "transparent", color: "var(--text-secondary, #6b7280)", fontWeight: 600, fontSize: 12,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Deselect All</button>
        </div>
      </div>

      {/* Results cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
        {results.map((result, rIdx) => (
          <div key={rIdx} style={{
            border: "1.5px solid var(--border-secondary, #e5e7eb)", borderRadius: 14,
            overflow: "hidden", background: "var(--bg-primary, #fff)",
          }}>
            {/* Card header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
              background: "var(--bg-secondary, #f9fafb)", borderBottom: "1px solid var(--border-secondary, #e5e7eb)",
              cursor: "pointer",
            }} onClick={() => toggleAll(rIdx, result.fields || [])}>
              <span style={{ fontSize: 22 }}>{TYPE_ICONS[result.image_type] || "📄"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary, #111)" }}>
                  {result.title || result.fileName}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--text-tertiary, #9ca3af)" }}>
                  {result.fileName} • {result.fields?.length || 0} fields found
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                background: "rgba(13,148,136,0.1)", color: "#0d9488",
                fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize",
              }}>{result.image_type?.replace("_", " ")}</span>
            </div>

            {/* Fields list */}
            <div style={{ padding: "8px 12px" }}>
              {(result.fields || []).map((field, fIdx) => {
                const key = `${rIdx}-${fIdx}`;
                const isSelected = selected.has(key);
                return (
                  <div key={fIdx} onClick={() => toggleField(rIdx, fIdx)} style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 6px",
                    borderRadius: 8, cursor: "pointer", transition: "background 0.15s",
                    background: isSelected ? "rgba(13,148,136,0.04)" : "transparent",
                  }}>
                    {/* Checkbox */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      border: isSelected ? "none" : "2px solid var(--border-secondary, #d1d5db)",
                      background: isSelected ? "linear-gradient(135deg, #0d9488, #0f766e)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s ease", color: "#fff", fontSize: 12, fontWeight: 700,
                    }}>
                      {isSelected && "✓"}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                          color: "var(--text-primary, #111)",
                        }}>{field.label}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: "1px 7px", borderRadius: 99,
                          background: `${CAT_COLORS[field.category] || CAT_COLORS.other}18`,
                          color: CAT_COLORS[field.category] || CAT_COLORS.other,
                          fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize",
                        }}>{field.category?.replace("_", " ")}</span>
                      </div>
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--text-secondary, #6b7280)",
                        wordBreak: "break-word",
                      }}>{field.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={{
          flex: 1, padding: "13px 0", borderRadius: 12,
          border: "1.5px solid var(--border-secondary, #d1d5db)", background: "transparent",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
          cursor: "pointer", color: "var(--text-secondary, #6b7280)",
        }}>← Re-upload</button>
        <button onClick={onNext} disabled={selected.size === 0} style={{
          flex: 2, padding: "13px 0", borderRadius: 12, border: "none",
          background: selected.size > 0 ? "linear-gradient(135deg, #0d9488, #0f766e)" : "var(--bg-tertiary, #e5e7eb)",
          color: selected.size > 0 ? "#fff" : "var(--text-tertiary, #9ca3af)",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
          cursor: selected.size > 0 ? "pointer" : "not-allowed",
          boxShadow: selected.size > 0 ? "0 4px 16px rgba(13,148,136,0.25)" : "none",
        }}>Export {selected.size} Fields →</button>
      </div>
    </div>
  );
}

// ── EXPORT STEP ──
function ExportStep({ results, selected, onBack, onRestart }) {
  const [exporting, setExporting] = useState(null);
  const [done, setDone] = useState(null);

  // Build selected data
  const getSelectedData = () => {
    const data = [];
    results.forEach((r, rIdx) => {
      const fields = (r.fields || []).filter((_, fIdx) => selected.has(`${rIdx}-${fIdx}`));
      if (fields.length > 0) {
        data.push({ source: r.title || r.fileName, type: r.image_type, fields });
      }
    });
    return data;
  };

  // ── Export as PDF (HTML-based) ──
  const exportPDF = async () => {
    setExporting("pdf");
    const data = getSelectedData();
    const htmlContent = `
      <html><head><meta charset="UTF-8">
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:40px;color:#1a1a2e;max-width:800px;margin:0 auto}
        h1{color:#0d9488;border-bottom:3px solid #0d9488;padding-bottom:12px;font-size:24px}
        h2{color:#1a1a2e;margin-top:32px;font-size:18px;display:flex;align-items:center;gap:8px}
        .badge{background:#e0f2f1;color:#0d9488;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600}
        table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px}
        th{background:#f0fdfa;color:#0d9488;text-align:left;padding:10px 14px;border:1px solid #d1d5db;font-weight:700}
        td{padding:9px 14px;border:1px solid #e5e7eb}
        tr:nth-child(even) td{background:#fafafa}
        .cat{display:inline-block;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:600;text-transform:capitalize}
        .footer{margin-top:40px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px}
      </style></head><body>
      <h1>📋 Extracted Medical Data</h1>
      <p style="color:#6b7280;font-size:13px">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • Dr. M R Sifat's Inventory</p>
      ${data.map(d => `
        <h2>${d.source} <span class="badge">${d.type?.replace('_', ' ')}</span></h2>
        <table>
          <thead><tr><th style="width:30%">Field</th><th>Value</th><th style="width:18%">Category</th></tr></thead>
          <tbody>
            ${d.fields.map(f => `<tr><td><strong>${f.label}</strong></td><td>${f.value}</td><td><span class="cat" style="background:rgba(13,148,136,0.1);color:#0d9488">${f.category?.replace('_', ' ')}</span></td></tr>`).join('')}
          </tbody>
        </table>
      `).join('')}
      <div class="footer">Generated by Dr. M R Sifat's Inventory</div>
      </body></html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-data-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
    setDone("pdf");
  };

  // ── Export as Image (canvas) ──
  const exportImage = async () => {
    setExporting("image");
    const data = getSelectedData();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const W = 1200;
    let y = 0;
    const lineH = 28;
    const headerH = 50;
    
    // Calculate height
    let totalRows = 0;
    data.forEach(d => { totalRows += d.fields.length + 2; });
    const H = 160 + totalRows * lineH + data.length * headerH + 60;
    
    canvas.width = W;
    canvas.height = H;
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    
    // Title
    y = 48;
    ctx.fillStyle = '#0d9488';
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    ctx.fillText('📋 Extracted Medical Data', 40, y);
    y += 32;
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText(`Generated on ${new Date().toLocaleDateString()} • Dr. M R Sifat's Inventory`, 40, y);
    y += 40;
    
    // Draw line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke();
    y += 24;
    
    data.forEach(d => {
      // Section header
      ctx.fillStyle = '#f0fdfa';
      ctx.fillRect(40, y - 4, W - 80, headerH);
      ctx.fillStyle = '#0d9488';
      ctx.font = 'bold 18px "Segoe UI", sans-serif';
      ctx.fillText(`${d.source}`, 56, y + 28);
      y += headerH + 12;
      
      // Table header
      ctx.fillStyle = '#0d9488';
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillText('Field', 56, y);
      ctx.fillText('Value', 320, y);
      ctx.fillText('Category', 900, y);
      y += lineH;
      
      ctx.strokeStyle = '#d1d5db';
      ctx.beginPath(); ctx.moveTo(40, y - 10); ctx.lineTo(W - 40, y - 10); ctx.stroke();
      
      d.fields.forEach((f, i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = '#fafafa';
          ctx.fillRect(40, y - 18, W - 80, lineH);
        }
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.fillText(f.label?.substring(0, 35) || '', 56, y);
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.fillText(f.value?.substring(0, 80) || '', 320, y);
        ctx.fillStyle = '#0d9488';
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.fillText(f.category?.replace('_', ' ') || '', 900, y);
        y += lineH;
      });
      y += 16;
    });
    
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extracted-data-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(null);
      setDone("image");
    }, 'image/png');
  };

  // ── Export as Google Doc (via AI-formatted content, copied to clipboard) ──
  const exportGoogleDoc = async () => {
    setExporting("gdoc");
    const data = getSelectedData();
    let text = "EXTRACTED MEDICAL DATA\n";
    text += `Generated on ${new Date().toLocaleDateString()} • Dr. M R Sifat's Inventory\n`;
    text += "═".repeat(60) + "\n\n";
    
    data.forEach(d => {
      text += `▸ ${d.source} [${d.type?.replace('_', ' ')}]\n`;
      text += "─".repeat(50) + "\n";
      d.fields.forEach(f => {
        text += `  ${f.label}: ${f.value}  (${f.category?.replace('_', ' ')})\n`;
      });
      text += "\n";
    });
    
    text += "\n" + "─".repeat(60) + "\nGenerated by Dr. M R Sifat's Inventory";
    
    try {
      await navigator.clipboard.writeText(text);
      setDone("gdoc");
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setDone("gdoc");
    }
    setExporting(null);
  };

  const EXPORTS = [
    { id: "pdf", icon: "📄", label: "Download as PDF", desc: "Clean tabulated HTML file, printable", action: exportPDF },
    { id: "image", icon: "🖼️", label: "Download as Image", desc: "PNG image with all data in a table", action: exportImage },
    { id: "gdoc", icon: "📝", label: "Copy for Google Doc", desc: "Formatted text copied to clipboard — paste into Google Docs", action: exportGoogleDoc },
  ];

  return (
    <div style={{ animation: "fadeUp 0.5s ease" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 42, marginBottom: 8 }}>🎉</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 20, color: "var(--text-primary, #111)" }}>
          Ready to Export!
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--text-secondary, #6b7280)", marginTop: 4 }}>
          {selected.size} fields from {results.length} image{results.length > 1 ? "s" : ""} • Choose your format below
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {EXPORTS.map(exp => (
          <button key={exp.id} onClick={exp.action} disabled={!!exporting} style={{
            display: "flex", alignItems: "center", gap: 16, padding: "18px 20px",
            borderRadius: 14, border: done === exp.id ? "2px solid #0d9488" : "1.5px solid var(--border-secondary, #e5e7eb)",
            background: done === exp.id ? "rgba(13,148,136,0.04)" : "var(--bg-primary, #fff)",
            cursor: exporting ? "wait" : "pointer", textAlign: "left",
            transition: "all 0.2s ease", width: "100%",
          }}>
            <span style={{ fontSize: 32 }}>{exp.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary, #111)" }}>
                {exporting === exp.id ? "Exporting..." : exp.label}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--text-secondary, #6b7280)", marginTop: 2 }}>
                {exp.desc}
              </div>
            </div>
            {done === exp.id && (
              <span style={{
                background: "#0d9488", color: "#fff", borderRadius: 99,
                padding: "4px 12px", fontSize: 12, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
              }}>✓ Done</span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={{
          flex: 1, padding: "13px 0", borderRadius: 12,
          border: "1.5px solid var(--border-secondary, #d1d5db)", background: "transparent",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
          cursor: "pointer", color: "var(--text-secondary, #6b7280)",
        }}>← Back to Selection</button>
        <button onClick={onRestart} style={{
          flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
          cursor: "pointer",
        }}>🔄 Scan New Photos</button>
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function PhotoDataScraper() {
  const [step, setStep] = useState("upload");
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const handleProcessDone = useCallback((res) => {
    setResults(res);
    // Auto-select all fields
    const all = new Set();
    res.forEach((r, ri) => r.fields?.forEach((_, fi) => all.add(`${ri}-${fi}`)));
    setSelected(all);
    setStep("select");
  }, []);

  const restart = () => {
    setStep("upload");
    setFiles([]);
    setResults([]);
    setSelected(new Set());
  };

  return (
    <div style={{
      minHeight: "100vh", padding: "24px 16px",
      background: "var(--bg-primary, #fff)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
      `}</style>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 22,
            background: "linear-gradient(135deg, #0d9488, #0f766e)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}>
            Dr. M R Sifat's Inventory
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--text-secondary, #6b7280)", marginTop: 2 }}>
            Photo Data Scraper — powered by AI
          </div>
        </div>

        <StepIndicator current={step} />

        {step === "upload" && (
          <UploadStep files={files} setFiles={setFiles} onNext={() => setStep("processing")} />
        )}
        {step === "processing" && (
          <ProcessingStep files={files} onDone={handleProcessDone} />
        )}
        {step === "select" && (
          <SelectStep
            results={results}
            selected={selected}
            setSelected={setSelected}
            onNext={() => setStep("export")}
            onBack={restart}
          />
        )}
        {step === "export" && (
          <ExportStep
            results={results}
            selected={selected}
            onBack={() => setStep("select")}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  );
}
