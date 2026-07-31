"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Item = {
  id: string;
  category: string;
  unitLabel: string;
  quantity: number;
  literPerUnit: number;
  assignedSpaceId: string | null;
};

type StorageSpace = {
  id: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  effectiveRate: number;
  tag: string;
};

type StorageProject = {
  format: "storage-simulator";
  version: 1;
  exportedAt: string;
  items: Item[];
  spaces: StorageSpace[];
};

const initialItems: Item[] = [
  { id: "on", category: "衣類（オンシーズン）", unitLabel: "衣装ケース", quantity: 2, literPerUnit: 70, assignedSpaceId: null },
  { id: "off", category: "衣類（オフシーズン）", unitLabel: "衣装ケース", quantity: 3, literPerUnit: 70, assignedSpaceId: null },
  { id: "hanger", category: "ハンガー掛け衣類", unitLabel: "着", quantity: 50, literPerUnit: 20, assignedSpaceId: null },
  { id: "bedding", category: "布団・寝具", unitLabel: "組", quantity: 2, literPerUnit: 90, assignedSpaceId: null },
  { id: "books", category: "書籍・書類", unitLabel: "段ボール", quantity: 2, literPerUnit: 60, assignedSpaceId: null },
  { id: "kitchen", category: "キッチン家電", unitLabel: "個", quantity: 5, literPerUnit: 20, assignedSpaceId: null },
  { id: "daily", category: "日用品ストック", unitLabel: "山", quantity: 4, literPerUnit: 15, assignedSpaceId: null },
  { id: "kids", category: "子ども用品", unitLabel: "箱", quantity: 3, literPerUnit: 50, assignedSpaceId: null },
  { id: "outdoor", category: "アウトドア・趣味用品", unitLabel: "箱", quantity: 2, literPerUnit: 80, assignedSpaceId: null },
  { id: "other", category: "その他", unitLabel: "箱", quantity: 0, literPerUnit: 50, assignedSpaceId: null },
];

const initialSpaces: StorageSpace[] = [
  { id: "wic", name: "ファミリークローゼット", widthMm: 2400, depthMm: 900, heightMm: 2300, effectiveRate: 0.7, tag: "衣類用" },
  { id: "pantry", name: "パントリー", widthMm: 1200, depthMm: 450, heightMm: 2200, effectiveRate: 0.7, tag: "食品・日用品" },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const liters = (space: StorageSpace) =>
  Math.round((space.widthMm * space.depthMm * space.heightMm * space.effectiveRate) / 1_000_000);
const itemLiters = (item: Item) => Math.round(item.quantity * item.literPerUnit);
const fmt = (n: number) => new Intl.NumberFormat("ja-JP").format(Math.round(n));
const encodeState = (value: StorageProject) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
};
const decodeState = (value: string) => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

function readSavedState() {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("storage-simulator-v1");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [spaces, setSpaces] = useState<StorageSpace[]>(initialSpaces);
  const [activeTab, setActiveTab] = useState<"place" | "items" | "spaces">("place");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fileMessage, setFileMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const state = readSavedState();
    if (state?.items && state?.spaces) {
      setItems(state.items);
      setSpaces(state.spaces);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("storage-simulator-v1", JSON.stringify({ items, spaces }));
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 900);
    return () => window.clearTimeout(timer);
  }, [items, spaces, hydrated]);

  const totalNeed = useMemo(() => items.reduce((sum, item) => sum + itemLiters(item), 0), [items]);
  const totalCapacity = useMemo(() => spaces.reduce((sum, space) => sum + liters(space), 0), [spaces]);
  const unassigned = items.filter((item) => !item.assignedSpaceId && itemLiters(item) > 0);
  const unassignedLiters = unassigned.reduce((sum, item) => sum + itemLiters(item), 0);
  const overallPercent = totalNeed ? Math.round((totalCapacity / totalNeed) * 100) : 0;

  const usageFor = (spaceId: string) =>
    items.filter((item) => item.assignedSpaceId === spaceId).reduce((sum, item) => sum + itemLiters(item), 0);

  const diagnosis = useMemo(() => {
    const overflow = spaces
      .map((space) => ({ space, over: usageFor(space.id) - liters(space) }))
      .filter((x) => x.over > 0)
      .sort((a, b) => b.over - a.over)[0];
    if (overflow) {
      return `${overflow.space.name}が${fmt(overflow.over)}L超過しています。カードを空きのある収納へ移して、置き場所の偏りを整えましょう。`;
    }
    if (unassignedLiters > 0) {
      return `全体容量には余裕があります。まず未配置の${fmt(unassignedLiters)}Lを収納先へ割り当てて、実際の収まり方を確認しましょう。`;
    }
    if (totalCapacity < totalNeed) {
      return `収納量が${fmt(totalNeed - totalCapacity)}L不足しています。収納寸法か、持ち物の数量を見直してみましょう。`;
    }
    return `すべて配置できています。空きは${fmt(totalCapacity - totalNeed)}Lです。増えやすい日用品や子ども用品の余白も確認しておくと安心です。`;
  }, [items, spaces, totalCapacity, totalNeed, unassignedLiters]);

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const updateSpace = (id: string, patch: Partial<StorageSpace>) =>
    setSpaces((current) => current.map((space) => (space.id === id ? { ...space, ...patch } : space)));

  const assign = (itemId: string, spaceId: string | null) => {
    updateItem(itemId, { assignedSpaceId: spaceId });
    setDraggedId(null);
  };

  const projectData = (): StorageProject => ({
    format: "storage-simulator",
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    spaces,
  });

  const loadProject = (data: unknown) => {
    const project = data as Partial<StorageProject>;
    if (!Array.isArray(project.items) || !Array.isArray(project.spaces)) {
      throw new Error("invalid-project");
    }
    const nextItems = project.items.filter((item) =>
      item && typeof item.id === "string" && typeof item.category === "string"
    ) as Item[];
    const nextSpaces = project.spaces.filter((space) =>
      space && typeof space.id === "string" && typeof space.name === "string"
    ) as StorageSpace[];
    if (!nextItems.length) throw new Error("empty-project");
    setItems(nextItems);
    setSpaces(nextSpaces);
    setActiveTab("place");
  };

  const importProject = async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const metadata = await pdf.getMetadata();
        const info = metadata.info as Record<string, unknown>;
        const encoded = typeof info.Keywords === "string" ? info.Keywords : "";
        if (!encoded.startsWith("storage-state:")) throw new Error("no-state");
        loadProject(decodeState(encoded.slice("storage-state:".length)));
        setFileMessage("PDFから編集データを読み込みました");
      } else {
        loadProject(JSON.parse(await file.text()));
        setFileMessage("JSONファイルを読み込みました");
      }
    } catch {
      alert("このアプリで保存したJSONまたはPDFを読み込んでください。");
    } finally {
      window.setTimeout(() => setFileMessage(""), 2200);
    }
  };

  const exportFile = (type: "json" | "csv") => {
    let content = "";
    let mime = "";
    if (type === "json") {
      content = JSON.stringify(projectData(), null, 2);
      mime = "application/json";
    } else {
      const header = ["カテゴリ", "数量", "単位", "L/単位", "必要量(L)", "収納先"];
      const rows = items.map((item) => [
        item.category,
        item.quantity,
        item.unitLabel,
        item.literPerUnit,
        itemLiters(item),
        spaces.find((space) => space.id === item.assignedSpaceId)?.name ?? "未配置",
      ]);
      content = "\ufeff" + [header, ...rows].map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
      mime = "text/csv;charset=utf-8";
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: mime }));
    link.download = `収納量シミュレーター_${new Date().toISOString().slice(0, 10)}.${type}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportPdf = async () => {
    setFileMessage("PDFを作成しています…");
    const report = document.createElement("section");
    report.className = "pdf-report";
    const rows = items.map((item) => {
      const destination = spaces.find((space) => space.id === item.assignedSpaceId)?.name ?? "未配置";
      return `<tr><td>${escapeHtml(item.category)}</td><td>${fmt(item.quantity)} ${escapeHtml(item.unitLabel)}</td><td>${fmt(itemLiters(item))} L</td><td>${escapeHtml(destination)}</td></tr>`;
    }).join("");
    const spaceRows = spaces.map((space) => {
      const used = usageFor(space.id);
      const capacity = liters(space);
      return `<tr><td>${escapeHtml(space.name)}</td><td>${fmt(used)} L</td><td>${fmt(capacity)} L</td><td>${capacity ? Math.round(used / capacity * 100) : 0}%</td></tr>`;
    }).join("");
    report.innerHTML = `
      <div class="pdf-report-head"><p>STORAGE PLANNING REPORT</p><h1>収納量シミュレーター</h1><span>${new Date().toLocaleDateString("ja-JP")}</span></div>
      <div class="pdf-summary">
        <div><span>収納容量</span><b>${fmt(totalCapacity)} L</b></div>
        <div><span>必要量</span><b>${fmt(totalNeed)} L</b></div>
        <div><span>全体充足率</span><b>${overallPercent}%</b></div>
        <div><span>未配置</span><b>${fmt(unassignedLiters)} L</b></div>
      </div>
      <div class="pdf-diagnosis"><b>診断</b><p>${escapeHtml(diagnosis)}</p></div>
      <h2>収納スペース</h2><table><thead><tr><th>名称</th><th>使用量</th><th>容量</th><th>使用率</th></tr></thead><tbody>${spaceRows}</tbody></table>
      <h2>持ち物と配置先</h2><table><thead><tr><th>カテゴリ</th><th>数量</th><th>必要量</th><th>収納先</th></tr></thead><tbody>${rows}</tbody></table>
      <footer>収納量シミュレーターで作成・このPDFをアプリに読み込むと編集を再開できます</footer>`;
    document.body.appendChild(report);
    try {
      const canvas = await html2canvas(report, { scale: 1.6, backgroundColor: "#f6f4ee", logging: false });
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const image = canvas.toDataURL("image/jpeg", 0.9);
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = canvas.height * imageWidth / canvas.width;
      let sourceY = 0;
      const pageContentHeight = pageHeight - margin * 2;
      while (sourceY < imageHeight) {
        if (sourceY > 0) doc.addPage();
        doc.addImage(image, "JPEG", margin, margin - sourceY, imageWidth, imageHeight, undefined, "FAST");
        sourceY += pageContentHeight;
      }
      doc.setProperties({
        title: "収納量シミュレーター",
        subject: "収納計画レポート",
        creator: "収納量シミュレーター",
        keywords: `storage-state:${encodeState(projectData())}`,
      });
      doc.save(`収納計画_${new Date().toISOString().slice(0, 10)}.pdf`);
      setFileMessage("PDFを保存しました");
    } finally {
      report.remove();
      window.setTimeout(() => setFileMessage(""), 2200);
    }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="収納量シミュレーター トップ">
          <span className="brand-mark" aria-hidden="true">収</span>
          <span>収納量シミュレーター</span>
        </a>
        <div className="header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.pdf,application/json,application/pdf"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importProject(file);
              event.target.value = "";
            }}
          />
          <span className={`save-state ${(saved || fileMessage) ? "show" : ""}`}>{fileMessage || "保存しました"}</span>
          <button className="ghost" onClick={() => fileInputRef.current?.click()}>開く</button>
          <button className="ghost" onClick={() => exportFile("json")}>JSON保存</button>
          <button className="ghost pdf-button" onClick={() => void exportPdf()}>PDF出力</button>
          <button className="ghost" onClick={() => exportFile("csv")}>CSV</button>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">STORAGE PLANNING TOOL</p>
          <h1>「入るはず」を、<br /><em>入る数字</em>に。</h1>
          <p className="lead">持ち物の量と収納の内寸を入力して、どこに何をしまうかまで試せます。</p>
        </div>
        <div className="summary-card">
          <div className="summary-top">
            <span>全体の収納充足率</span>
            <strong className={overallPercent < 100 ? "warn-text" : ""}>{overallPercent}<small>%</small></strong>
          </div>
          <div className="summary-track"><i style={{ width: `${Math.min(overallPercent, 100)}%` }} /></div>
          <div className="summary-stats">
            <div><span>収納容量</span><b>{fmt(totalCapacity)} L</b></div>
            <div><span>必要量</span><b>{fmt(totalNeed)} L</b></div>
            <div><span>未配置</span><b>{fmt(unassignedLiters)} L</b></div>
          </div>
        </div>
      </section>

      <section className="diagnosis">
        <span aria-hidden="true">!</span>
        <div><b>いまの診断</b><p>{diagnosis}</p></div>
      </section>

      <nav className="tabs" aria-label="編集メニュー">
        <button className={activeTab === "place" ? "active" : ""} onClick={() => setActiveTab("place")}>配置する</button>
        <button className={activeTab === "items" ? "active" : ""} onClick={() => setActiveTab("items")}>持ち物を編集 <span>{items.length}</span></button>
        <button className={activeTab === "spaces" ? "active" : ""} onClick={() => setActiveTab("spaces")}>収納を編集 <span>{spaces.length}</span></button>
      </nav>

      {activeTab === "place" && (
        <section className="placement">
          <div
            className={`tray ${draggedId ? "drop-ready" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => draggedId && assign(draggedId, null)}
          >
            <div className="section-title">
              <div><p>UNASSIGNED</p><h2>未配置の持ち物</h2></div>
              <b>{unassigned.length} 品目・{fmt(unassignedLiters)} L</b>
            </div>
            <div className="cards">
              {unassigned.length ? unassigned.map((item) => (
                <ItemCard key={item.id} item={item} onDrag={() => setDraggedId(item.id)} />
              )) : <div className="empty">すべての持ち物を配置しました</div>}
            </div>
          </div>

          <div className="space-heading">
            <div><p>STORAGE SPACES</p><h2>収納スペース</h2></div>
            <span>カードをドラッグして配置</span>
          </div>
          <div className="space-grid">
            {spaces.map((space) => {
              const capacity = liters(space);
              const used = usageFor(space.id);
              const percent = capacity ? Math.round((used / capacity) * 100) : 0;
              const overflow = used > capacity;
              const assigned = items.filter((item) => item.assignedSpaceId === space.id);
              return (
                <article
                  key={space.id}
                  className={`space-card ${overflow ? "overflow" : ""} ${draggedId ? "drop-ready" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => draggedId && assign(draggedId, space.id)}
                >
                  <div className="space-card-head">
                    <div><span>{space.tag || "収納"}</span><h3>{space.name}</h3></div>
                    <button aria-label={`${space.name}を編集`} onClick={() => setActiveTab("spaces")}>編集</button>
                  </div>
                  <div className="gauge-label">
                    <b>{fmt(used)} <small>/ {fmt(capacity)} L</small></b>
                    <span>{percent}%</span>
                  </div>
                  <div className="gauge"><i style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                  {overflow && <p className="over-message">容量を {fmt(used - capacity)} L 超過しています</p>}
                  <div className="assigned-cards">
                    {assigned.map((item) => (
                      <ItemCard key={item.id} item={item} compact onDrag={() => setDraggedId(item.id)} />
                    ))}
                    {!assigned.length && <div className="drop-hint">ここに持ち物をドロップ</div>}
                  </div>
                </article>
              );
            })}
            <button className="add-space-tile" onClick={() => setActiveTab("spaces")}><b>＋</b><span>収納スペースを追加</span></button>
          </div>
        </section>
      )}

      {activeTab === "items" && (
        <section className="editor-panel">
          <div className="editor-heading"><div><p>INVENTORY</p><h2>持ち物の棚卸し</h2></div><button className="primary" onClick={() => setItems((v) => [...v, { id: uid(), category: "新しいカテゴリ", unitLabel: "個", quantity: 1, literPerUnit: 50, assignedSpaceId: null }])}>＋ カテゴリを追加</button></div>
          <p className="helper">お手元のケースや箱に合わせて、数量と1単位あたりの容量を調整してください。</p>
          <div className="edit-list">
            {items.map((item) => (
              <div className="edit-row" key={item.id}>
                <label className="wide">カテゴリ<input value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value })} /></label>
                <label>数量<input type="number" min="0" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} /></label>
                <label>単位<input value={item.unitLabel} onChange={(e) => updateItem(item.id, { unitLabel: e.target.value })} /></label>
                <label>L / 単位<input type="number" min="0" value={item.literPerUnit} onChange={(e) => updateItem(item.id, { literPerUnit: Number(e.target.value) })} /></label>
                <div className="row-total"><span>必要量</span><b>{fmt(itemLiters(item))} L</b></div>
                <button className="delete" aria-label={`${item.category}を削除`} onClick={() => setItems((v) => v.filter((x) => x.id !== item.id))}>×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "spaces" && (
        <section className="editor-panel">
          <div className="editor-heading"><div><p>STORAGE SPACES</p><h2>収納スペースの内寸</h2></div><button className="primary" onClick={() => setSpaces((v) => [...v, { id: uid(), name: "新しい収納", widthMm: 1200, depthMm: 600, heightMm: 2200, effectiveRate: 0.7, tag: "" }])}>＋ 収納を追加</button></div>
          <p className="helper">通路や棚板を考慮した有効率は70%を目安に、収納の形に合わせて調整できます。</p>
          <div className="space-edit-grid">
            {spaces.map((space) => (
              <div className="space-edit-card" key={space.id}>
                <div className="space-edit-top"><label>名称<input value={space.name} onChange={(e) => updateSpace(space.id, { name: e.target.value })} /></label><button className="delete" onClick={() => { setSpaces((v) => v.filter((x) => x.id !== space.id)); setItems((v) => v.map((item) => item.assignedSpaceId === space.id ? { ...item, assignedSpaceId: null } : item)); }}>×</button></div>
                <label>用途タグ<input placeholder="例：衣類用" value={space.tag} onChange={(e) => updateSpace(space.id, { tag: e.target.value })} /></label>
                <div className="dimensions">
                  <label>幅 mm<input type="number" min="0" value={space.widthMm} onChange={(e) => updateSpace(space.id, { widthMm: Number(e.target.value) })} /></label>
                  <span>×</span>
                  <label>奥行 mm<input type="number" min="0" value={space.depthMm} onChange={(e) => updateSpace(space.id, { depthMm: Number(e.target.value) })} /></label>
                  <span>×</span>
                  <label>高さ mm<input type="number" min="0" value={space.heightMm} onChange={(e) => updateSpace(space.id, { heightMm: Number(e.target.value) })} /></label>
                </div>
                <label>有効率 <b>{Math.round(space.effectiveRate * 100)}%</b><input className="range" type="range" min="20" max="100" value={space.effectiveRate * 100} onChange={(e) => updateSpace(space.id, { effectiveRate: Number(e.target.value) / 100 })} /></label>
                <div className="capacity-result"><span>有効収納容量</span><b>{fmt(liters(space))} L</b></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer><span>データはこの端末に自動保存されます</span><button onClick={() => { if (confirm("入力内容を初期状態に戻しますか？")) { setItems(initialItems); setSpaces(initialSpaces); } }}>初期状態に戻す</button></footer>
    </main>
  );
}

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function ItemCard({ item, compact = false, onDrag }: { item: Item; compact?: boolean; onDrag: () => void }) {
  return (
    <div className={`item-card ${compact ? "compact" : ""}`} draggable onDragStart={onDrag}>
      <span className="drag-handle" aria-hidden="true">⠿</span>
      <div><b>{item.category}</b><p>{fmt(item.quantity)} {item.unitLabel} × {fmt(item.literPerUnit)} L</p></div>
      <strong>{fmt(itemLiters(item))}<small>L</small></strong>
    </div>
  );
}
