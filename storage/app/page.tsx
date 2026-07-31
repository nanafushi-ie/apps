"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

type Category = "shoes" | "clothes" | "books";
type StorageMode = "unknown" | "partial" | "known";
type DimensionKey = "width" | "height" | "depth";

type Dimensions = Record<DimensionKey, number> & Record<`${DimensionKey}Unknown`, boolean>;
type AppState = {
  category: Category;
  storageMode: StorageMode;
  shoes: { adult: number; child: number; boots: number };
  clothes: { hanger: number; heavy: number; folded: number };
  books: { paperback: number; standard: number; large: number };
  dimensions: Dimensions;
  margin: number;
};

const initialState: AppState = {
  category: "shoes",
  storageMode: "unknown",
  shoes: { adult: 16, child: 6, boots: 2 },
  clothes: { hanger: 35, heavy: 8, folded: 50 },
  books: { paperback: 80, standard: 45, large: 15 },
  dimensions: { width: 900, height: 1800, depth: 350, widthUnknown: false, heightUnknown: true, depthUnknown: true },
  margin: 15,
};

const categoryInfo: Record<Category, { label: string; icon: string; description: string }> = {
  shoes: { label: "靴", icon: "⌁", description: "靴棚の幅と高さを考える" },
  clothes: { label: "衣類", icon: "♧", description: "掛ける・たたむを一緒に計算" },
  books: { label: "書籍", icon: "▥", description: "本棚の幅と高さを考える" },
};

const dimensionLabels: Record<DimensionKey, string> = { width: "内寸幅", height: "内寸高さ", depth: "内寸奥行き" };
const roundUp = (value: number, unit: number) => Math.ceil(value / unit) * unit;

function NumberField({ label, value, unit, step = 1, min = 0, disabled = false, onChange }: {
  label: string; value: number; unit: string; step?: number; min?: number; disabled?: boolean; onChange: (value: number) => void;
}) {
  return (
    <label className={`number-field ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <span className="number-input">
        <button type="button" disabled={disabled} aria-label={`${label}を減らす`} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <input type="number" min={min} step={step} value={value} disabled={disabled} aria-label={label} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))} />
        <b>{unit}</b>
        <button type="button" disabled={disabled} aria-label={`${label}を増やす`} onClick={() => onChange(value + step)}>＋</button>
      </span>
    </label>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [message, setMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("shimaeru-state-v2");
      if (saved) setState({ ...initialState, ...JSON.parse(saved) });
    } catch { /* 初期値を使う */ }
  }, []);

  useEffect(() => { localStorage.setItem("shimaeru-state-v2", JSON.stringify(state)); }, [state]);

  const update = <K extends keyof AppState>(key: K, value: AppState[K]) => setState((current) => ({ ...current, [key]: value }));
  const dimensionUnknown = (key: DimensionKey) => state.storageMode === "unknown" || (state.storageMode === "partial" && state.dimensions[`${key}Unknown`]);

  const result = useMemo(() => {
    const marginFactor = 1 + state.margin / 100;
    const d = state.dimensions;
    let recommended = { width: 900, height: 1800, depth: 350 };
    let requiredLength = 0;
    let rowHeight = 200;
    let details: string[] = [];
    let kind: Category = state.category;
    let count = 0;
    let unit = "個";
    let extraNote = "";

    if (state.category === "shoes") {
      const { adult, child, boots } = state.shoes;
      count = adult + child + boots;
      unit = "足";
      requiredLength = (adult * 220 + child * 170 + boots * 240) * marginFactor;
      rowHeight = boots ? 240 : 200;
      recommended = { width: 900, height: Math.max(900, Math.ceil(requiredLength / 900) * rowHeight + 100), depth: boots ? 350 : 320 };
      details = [`大人用 ${adult}足`, `子ども用 ${child}足`, `ブーツ ${boots}足`];
      extraNote = "靴は1段に一列で並べる想定です。";
    } else if (state.category === "books") {
      const { paperback, standard, large } = state.books;
      count = paperback + standard + large;
      unit = "冊";
      requiredLength = (paperback * 15 + standard * 24 + large * 18) * marginFactor;
      rowHeight = large ? 300 : 240;
      recommended = { width: 900, height: Math.max(900, Math.ceil(requiredLength / 900) * rowHeight + 100), depth: large ? 300 : 220 };
      details = [`文庫・漫画 ${paperback}冊`, `単行本 ${standard}冊`, `大型本・雑誌 ${large}冊`];
      extraNote = "棚板がたわみにくいよう、1区画の幅は900mm以下を想定しています。";
    } else {
      const { hanger, heavy, folded } = state.clothes;
      count = hanger + heavy + folded;
      unit = "着";
      const pipeLength = (hanger * 35 + heavy * 65) * marginFactor;
      const drawers = Math.max(1, Math.ceil((folded * marginFactor) / 18));
      recommended = { width: Math.max(900, roundUp(pipeLength, 100)), height: Math.max(1800, drawers * 220 + 200), depth: 600 };
      requiredLength = pipeLength;
      details = [`ハンガー ${hanger}着`, `コート・厚手 ${heavy}着`, `たたむ衣類 ${folded}着`];
      extraNote = `パイプ約${roundUp(pipeLength, 100)}mmと、引き出し${drawers}段が目安です。`;
    }

    const output = { ...recommended };
    if (state.category !== "clothes") {
      if (!dimensionUnknown("width") && dimensionUnknown("height")) {
        output.width = d.width;
        output.height = Math.max(rowHeight + 100, Math.ceil(requiredLength / Math.max(1, d.width)) * rowHeight + 100);
      } else if (dimensionUnknown("width") && !dimensionUnknown("height")) {
        const levels = Math.max(1, Math.floor((d.height - 100) / rowHeight));
        output.width = roundUp(requiredLength / levels, 50);
        output.height = d.height;
      }
    }
    (Object.keys(dimensionLabels) as DimensionKey[]).forEach((key) => {
      if (!dimensionUnknown(key)) output[key] = d[key];
    });

    const levels = state.category === "clothes" ? 1 : Math.max(1, Math.floor((output.height - 100) / rowHeight));
    const capacityRatio = state.category === "clothes"
      ? Math.max(recommended.width / Math.max(1, output.width), recommended.height / Math.max(1, output.height), recommended.depth / Math.max(1, output.depth))
      : Math.max(requiredLength / Math.max(1, output.width * levels), recommended.depth / Math.max(1, output.depth));
    const fits = capacityRatio <= 1;
    const average = count ? requiredLength / count : 1;
    const capacityCount = state.category === "clothes"
      ? Math.floor(count / Math.max(1, capacityRatio))
      : Math.floor((output.width * levels) / Math.max(1, average));
    const difference = Math.abs(capacityCount - count);
    const dimensionText = `幅${output.width} × 高さ${output.height} × 奥行き${output.depth} mm`;
    const partial = state.storageMode === "partial";
    const known = state.storageMode === "known";

    return {
      title: known ? (fits ? `この${categoryInfo[state.category].label}収納に収まります` : `この${categoryInfo[state.category].label}収納では足りません`)
        : partial ? (fits ? "未定の寸法を計算しました" : "固定した寸法では不足します")
          : `${count}${unit}に必要な収納サイズ`,
      main: known ? (fits ? `あと約${difference}${unit}分の余裕` : `約${difference || 1}${unit}分が不足`) : dimensionText,
      note: known ? (fits ? "出し入れの余裕を含めても収納できる計算です。" : `固定した寸法のいずれかが不足しています。必要寸法の目安は${dimensionText}です。`)
        : partial ? `${extraNote} 未定にした寸法だけを計算し、入力済みの寸法は固定しています。` : `${extraNote} ${state.margin}%の余裕を含みます。`,
      usage: known ? Math.round(capacityRatio * 100) : null,
      fit: fits,
      graphic: { filled: Math.min(100, capacityRatio * 100), units: state.category === "clothes" ? 5 : levels, kind },
      details,
      dimensions: (Object.keys(dimensionLabels) as DimensionKey[]).map((key) => ({ key, label: dimensionLabels[key], value: output[key], calculated: dimensionUnknown(key) })),
    };
  }, [state]);

  const createResultImage = async () => {
    if (!resultRef.current) return null;
    const canvas = await html2canvas(resultRef.current, { backgroundColor: "#f7f3e9", scale: 2, useCORS: true });
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const downloadBlob = (blob: Blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `shimaeru-${state.category}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const saveImage = async () => {
    const blob = await createResultImage();
    if (!blob) return;
    downloadBlob(blob);
    setMessage("結果画像を保存しました");
  };

  const shareResult = async (forX = false) => {
    const blob = await createResultImage();
    if (!blob) return;
    const file = new File([blob], "shimaeru-result.png", { type: "image/png" });
    const text = `${result.title}。${result.main}\n#しまえる #収納 #ななふしの家`;
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "しまえる？", text, files: [file] });
        return;
      }
      if (forX) {
        downloadBlob(blob);
        window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
        setMessage("画像を保存しました。開いたXの投稿画面で画像を添付してください");
      } else {
        await navigator.clipboard.writeText(text);
        setMessage("共有文をコピーしました。画像は保存ボタンから保存できます");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setMessage("共有できませんでした。画像保存をお試しください");
    }
  };

  const renderInputs = () => {
    if (state.category === "shoes") return <div className="field-grid"><NumberField label="大人用" value={state.shoes.adult} unit="足" onChange={(adult) => update("shoes", { ...state.shoes, adult })} /><NumberField label="子ども用" value={state.shoes.child} unit="足" onChange={(child) => update("shoes", { ...state.shoes, child })} /><NumberField label="ブーツ・長靴" value={state.shoes.boots} unit="足" onChange={(boots) => update("shoes", { ...state.shoes, boots })} /></div>;
    if (state.category === "clothes") return <div className="field-grid"><NumberField label="薄手・普通の衣類" value={state.clothes.hanger} unit="着" onChange={(hanger) => update("clothes", { ...state.clothes, hanger })} /><NumberField label="コート・厚手衣類" value={state.clothes.heavy} unit="着" onChange={(heavy) => update("clothes", { ...state.clothes, heavy })} /><NumberField label="たたむ衣類" value={state.clothes.folded} unit="着" onChange={(folded) => update("clothes", { ...state.clothes, folded })} /></div>;
    return <div className="field-grid"><NumberField label="文庫・漫画" value={state.books.paperback} unit="冊" onChange={(paperback) => update("books", { ...state.books, paperback })} /><NumberField label="単行本" value={state.books.standard} unit="冊" onChange={(standard) => update("books", { ...state.books, standard })} /><NumberField label="大型本・雑誌" value={state.books.large} unit="冊" onChange={(large) => update("books", { ...state.books, large })} /></div>;
  };

  const renderStorageInputs = () => (
    <div className="storage-fields">
      {(Object.keys(dimensionLabels) as DimensionKey[]).map((key) => {
        const unknownKey = `${key}Unknown` as const;
        const isUnknown = state.storageMode === "partial" && state.dimensions[unknownKey];
        return (
          <div className="dimension-field" key={key}>
            <NumberField label={dimensionLabels[key]} value={state.dimensions[key]} unit="mm" step={50} disabled={isUnknown} onChange={(value) => update("dimensions", { ...state.dimensions, [key]: value })} />
            {state.storageMode === "partial" && (
              <label className="unknown-check"><input type="checkbox" checked={isUnknown} onChange={(event) => update("dimensions", { ...state.dimensions, [unknownKey]: event.target.checked })} />未定</label>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <main>
      <header className="site-header"><a className="brand" href="#" aria-label="しまえる？ トップ"><span className="brand-mark">し</span><span>しまえる？</span></a><p>用途別収納サイズシミュレーター</p></header>

      <section className="hero">
        <p className="eyebrow">STORAGE SIZE GUIDE</p>
        <p className="hero-lead">持ち物の数から、ちょうどいい収納を。<br />決まっている寸法だけを使って、残りのサイズも計算できます。</p>
        <div className="hero-shelf" aria-hidden="true"><span>▰</span><span>▥</span><span>▰</span><span>▥</span><span>▰</span></div>
      </section>

      <section className="simulator">
        <div className="step-heading"><span>01</span><div><h2>何を収納しますか？</h2><p>数が増減しやすいものから選べます</p></div></div>
        <div className="category-tabs">
          {(Object.keys(categoryInfo) as Category[]).map((category) => <button type="button" key={category} className={state.category === category ? "active" : ""} onClick={() => update("category", category)}><i>{categoryInfo[category].icon}</i><b>{categoryInfo[category].label}</b><small>{categoryInfo[category].description}</small></button>)}
        </div>

        <div className="workspace">
          <section className="input-panel">
            <div className="step-heading compact"><span>02</span><div><h2>持ち物の数</h2><p>だいたいの数でも試せます</p></div></div>
            {renderInputs()}
            <div className="mode-block">
              <div className="step-heading compact"><span>03</span><div><h2>収納のサイズ</h2><p>決まっている範囲を教えてください</p></div></div>
              <div className="mode-options">
                <button type="button" className={state.storageMode === "unknown" ? "selected" : ""} onClick={() => update("storageMode", "unknown")}><b>決まっていない</b><small>必要な3寸法を知りたい</small></button>
                <button type="button" className={state.storageMode === "partial" ? "selected" : ""} onClick={() => update("storageMode", "partial")}><b>部分的に決まっている</b><small>未定の寸法だけ知りたい</small></button>
                <button type="button" className={state.storageMode === "known" ? "selected" : ""} onClick={() => update("storageMode", "known")}><b>すべて決まっている</b><small>十分に収まるか知りたい</small></button>
              </div>
              {state.storageMode !== "unknown" && renderStorageInputs()}
            </div>
            <label className="margin-field"><span><b>増える分・出し入れの余裕</b><small>{state.margin}%</small></span><input type="range" min="0" max="30" step="5" value={state.margin} onChange={(event) => update("margin", Number(event.target.value))} /><span className="range-labels"><small>ぴったり</small><small>ゆったり</small></span></label>
          </section>

          <section className="result-column">
            <div className={`result-card ${!result.fit ? "shortage" : ""}`} ref={resultRef}>
              <div className="result-brand">しまえる？ <span>収納サイズ診断</span></div>
              <p className="result-type">{categoryInfo[state.category].label}の結果</p>
              <h2>{result.title}</h2><strong>{result.main}</strong>
              {result.usage !== null && <div className="usage"><div><span>収納使用率</span><b>{result.usage}%</b></div><div className="usage-track"><i style={{ width: `${Math.min(100, result.usage)}%` }} /></div></div>}
              {state.storageMode !== "known" && <div className="dimension-result">{result.dimensions.map((dimension) => <div key={dimension.key} className={dimension.calculated ? "calculated" : "fixed"}><small>{dimension.label}{dimension.calculated ? "（算出）" : "（固定）"}</small><b>{dimension.value}<span>mm</span></b></div>)}</div>}
              <div className={`storage-visual visual-${result.graphic.kind}`} aria-label="収納量のイメージ">{Array.from({ length: Math.min(8, Math.max(3, result.graphic.units)) }).map((_, index, all) => <span key={index} className={index / all.length * 100 < result.graphic.filled ? "filled" : ""}>{result.graphic.kind === "shoes" ? "⌁  ⌁  ⌁" : result.graphic.kind === "books" ? "▥ ▥ ▥ ▥" : "♧ ♧ ♧"}</span>)}</div>
              <p className="result-note">{result.note}</p>
              <div className="result-details">{result.details.map((detail) => <span key={detail}>{detail}</span>)}</div>
              <div className="share-hashtags">#しまえる　#収納　#ななふしの家</div>
              <p className="result-disclaimer">一般的な持ち物寸法から算出した目安です。実際の内寸や収納方法によって変わります。</p>
            </div>
            <div className="share-panel"><h3>この結果を家族と相談する</h3><button type="button" className="share-primary" onClick={() => void shareResult()}>画像付きで共有</button><div><button type="button" onClick={() => void saveImage()}>画像を保存</button><button type="button" onClick={() => void shareResult(true)}>Xへ画像を共有</button></div>{message && <p role="status">{message}</p>}</div>
          </section>
        </div>
      </section>
      <footer><b>しまえる？</b><span>数えて、測って、ちょうどよく。</span></footer>
    </main>
  );
}
