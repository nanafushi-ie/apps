"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

type Category = "shoes" | "clothes" | "books";
type StorageMode = "unknown" | "known";

type AppState = {
  category: Category;
  storageMode: StorageMode;
  shoes: { adult: number; child: number; boots: number; width: number; depth: number; levels: number };
  clothes: { hanger: number; heavy: number; folded: number; pipe: number; drawers: number };
  books: { paperback: number; standard: number; large: number; width: number; depth: number; levels: number };
  margin: number;
};

const initialState: AppState = {
  category: "shoes",
  storageMode: "unknown",
  shoes: { adult: 16, child: 6, boots: 2, width: 900, depth: 350, levels: 6 },
  clothes: { hanger: 35, heavy: 8, folded: 50, pipe: 1800, drawers: 4 },
  books: { paperback: 80, standard: 45, large: 15, width: 900, depth: 300, levels: 5 },
  margin: 15,
};

const categoryInfo: Record<Category, { label: string; icon: string; description: string }> = {
  shoes: { label: "靴", icon: "⌁", description: "靴棚の幅と段数を考える" },
  clothes: { label: "衣類", icon: "♧", description: "掛ける・たたむを一緒に計算" },
  books: { label: "書籍", icon: "▥", description: "本棚の長さと段数を考える" },
};

const roundUp = (value: number, unit: number) => Math.ceil(value / unit) * unit;
const format = (value: number) => new Intl.NumberFormat("ja-JP").format(Math.round(value));

function NumberField({
  label,
  value,
  unit,
  step = 1,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="number-input">
        <button type="button" aria-label={`${label}を減らす`} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))}
        />
        <b>{unit}</b>
        <button type="button" aria-label={`${label}を増やす`} onClick={() => onChange(value + step)}>＋</button>
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
      const saved = localStorage.getItem("shimaeru-state-v1");
      if (saved) setState({ ...initialState, ...JSON.parse(saved) });
    } catch {
      // 保存データが壊れている場合は初期値を使う
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("shimaeru-state-v1", JSON.stringify(state));
  }, [state]);

  const update = <K extends keyof AppState>(key: K, value: AppState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const result = useMemo(() => {
    const marginFactor = 1 + state.margin / 100;

    if (state.category === "shoes") {
      const { adult, child, boots, width, depth, levels } = state.shoes;
      const total = adult + child + boots;
      const requiredLength = (adult * 220 + child * 170 + boots * 240) * marginFactor;
      const suggestedWidth = 900;
      const suggestedLevels = Math.max(1, Math.ceil(requiredLength / suggestedWidth));
      const suggestedHeight = Math.max(900, suggestedLevels * 200 + (boots ? 260 : 0));
      const available = width * levels;
      const ratio = available ? requiredLength / available : 9.99;
      const average = total ? requiredLength / total : 210;
      const difference = Math.floor(Math.abs(available - requiredLength) / average);
      const depthOk = depth >= (boots ? 350 : 320);
      const fits = ratio <= 1 && depthOk;

      return {
        title: state.storageMode === "known" ? (fits ? "この靴棚に収まります" : "この靴棚だけでは足りません") : `${total}足に必要な靴棚`,
        main: state.storageMode === "known"
          ? fits ? `あと約${difference}足分の余裕` : `約${difference || 1}足分が不足`
          : `幅${suggestedWidth}mm・${suggestedLevels}段が目安`,
        note: state.storageMode === "known"
          ? !depthOk ? "ブーツを含むため、奥行き350mm以上をおすすめします。"
            : ratio > 0.85 ? "収まりますが、出し入れの余裕は少なめです。" : "日常の出し入れと少しの買い足しにも対応できます。"
          : `奥行き${boots ? 350 : 320}mm、高さ約${suggestedHeight}mm。${state.margin}%の余裕を含みます。`,
        usage: state.storageMode === "known" ? Math.round(ratio * 100) : null,
        fit: fits,
        graphic: { filled: Math.min(100, ratio * 100), units: suggestedLevels, kind: "shoes" as const },
        details: [`大人用 ${adult}足`, `子ども用 ${child}足`, `ブーツ ${boots}足`],
      };
    }

    if (state.category === "clothes") {
      const { hanger, heavy, folded, pipe, drawers } = state.clothes;
      const requiredPipe = (hanger * 35 + heavy * 65) * marginFactor;
      const requiredDrawers = Math.max(1, Math.ceil((folded * marginFactor) / 18));
      const pipeRatio = pipe ? requiredPipe / pipe : 9.99;
      const drawerRatio = drawers ? requiredDrawers / drawers : 9.99;
      const ratio = Math.max(pipeRatio, drawerRatio);
      const fits = pipeRatio <= 1 && drawerRatio <= 1;
      const shortPipe = Math.max(0, roundUp(requiredPipe - pipe, 50));
      const shortDrawers = Math.max(0, requiredDrawers - drawers);

      return {
        title: state.storageMode === "known" ? (fits ? "この衣類収納に収まります" : "収納スペースが不足しています") : "衣類に必要な収納",
        main: state.storageMode === "known"
          ? fits ? `パイプ・引き出しともに余裕あり`
            : `${shortPipe ? `パイプ約${shortPipe}mm` : ""}${shortPipe && shortDrawers ? "・" : ""}${shortDrawers ? `引き出し${shortDrawers}段` : ""}不足`
          : `パイプ約${roundUp(requiredPipe, 100)}mm・引き出し${requiredDrawers}段`,
        note: state.storageMode === "known"
          ? fits ? "衣類を押し込まず、選びやすい密度で収納できます。" : "掛ける衣類とたたむ衣類を分けて判定しています。"
          : `薄手35mm、厚手65mm、引き出し1段18着を目安に、${state.margin}%の余裕を含みます。`,
        usage: state.storageMode === "known" ? Math.round(ratio * 100) : null,
        fit: fits,
        graphic: { filled: Math.min(100, ratio * 100), units: 5, kind: "clothes" as const },
        details: [`ハンガー ${hanger}着`, `コート・厚手 ${heavy}着`, `たたむ衣類 ${folded}着`],
      };
    }

    const { paperback, standard, large, width, depth, levels } = state.books;
    const total = paperback + standard + large;
    const requiredLength = (paperback * 15 + standard * 24 + large * 18) * marginFactor;
    const suggestedWidth = 900;
    const suggestedLevels = Math.max(1, Math.ceil(requiredLength / suggestedWidth));
    const available = width * levels;
    const ratio = available ? requiredLength / available : 9.99;
    const average = total ? requiredLength / total : 20;
    const difference = Math.floor(Math.abs(available - requiredLength) / average);
    const depthOk = depth >= (large ? 300 : 220);
    const fits = ratio <= 1 && depthOk;

    return {
      title: state.storageMode === "known" ? (fits ? "この本棚に収まります" : "この本棚だけでは足りません") : `${total}冊に必要な本棚`,
      main: state.storageMode === "known"
        ? fits ? `あと約${difference}冊分の余裕` : `約${difference || 1}冊分が不足`
        : `幅${suggestedWidth}mm・${suggestedLevels}段が目安`,
      note: state.storageMode === "known"
        ? !depthOk ? "大型本を含むため、奥行き300mm以上をおすすめします。"
          : ratio > 0.9 ? "収まりますが、新しい本を増やす余裕は少なめです。" : "本を増やす余裕を残して収納できます。"
        : `奥行き${large ? 300 : 220}mm。棚板はたわみにくい幅900mm以下を想定しています。`,
      usage: state.storageMode === "known" ? Math.round(ratio * 100) : null,
      fit: fits,
      graphic: { filled: Math.min(100, ratio * 100), units: suggestedLevels, kind: "books" as const },
      details: [`文庫・漫画 ${paperback}冊`, `単行本 ${standard}冊`, `大型本・雑誌 ${large}冊`],
    };
  }, [state]);

  const createResultImage = async () => {
    if (!resultRef.current) return null;
    const canvas = await html2canvas(resultRef.current, {
      backgroundColor: "#f7f3e9",
      scale: 2,
      useCORS: true,
    });
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const saveImage = async () => {
    const blob = await createResultImage();
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `shimaeru-${state.category}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage("結果画像を保存しました");
  };

  const shareResult = async () => {
    const blob = await createResultImage();
    if (!blob) return;
    const file = new File([blob], "shimaeru-result.png", { type: "image/png" });
    const text = `${result.title}。${result.main}｜しまえる？`;
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "しまえる？", text, files: [file] });
      } else {
        await navigator.clipboard.writeText(text);
        setMessage("共有文をコピーしました。画像は保存ボタンから保存できます");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setMessage("共有できませんでした。画像保存をお試しください");
    }
  };

  const shareToX = () => {
    const text = `${result.title}\n${result.main}\n#しまえる #収納`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const renderInputs = () => {
    if (state.category === "shoes") {
      return (
        <div className="field-grid">
          <NumberField label="大人用" value={state.shoes.adult} unit="足" onChange={(adult) => update("shoes", { ...state.shoes, adult })} />
          <NumberField label="子ども用" value={state.shoes.child} unit="足" onChange={(child) => update("shoes", { ...state.shoes, child })} />
          <NumberField label="ブーツ・長靴" value={state.shoes.boots} unit="足" onChange={(boots) => update("shoes", { ...state.shoes, boots })} />
        </div>
      );
    }

    if (state.category === "clothes") {
      return (
        <div className="field-grid">
          <NumberField label="薄手・普通の衣類" value={state.clothes.hanger} unit="着" onChange={(hanger) => update("clothes", { ...state.clothes, hanger })} />
          <NumberField label="コート・厚手衣類" value={state.clothes.heavy} unit="着" onChange={(heavy) => update("clothes", { ...state.clothes, heavy })} />
          <NumberField label="たたむ衣類" value={state.clothes.folded} unit="着" onChange={(folded) => update("clothes", { ...state.clothes, folded })} />
        </div>
      );
    }

    return (
      <div className="field-grid">
        <NumberField label="文庫・漫画" value={state.books.paperback} unit="冊" onChange={(paperback) => update("books", { ...state.books, paperback })} />
        <NumberField label="単行本" value={state.books.standard} unit="冊" onChange={(standard) => update("books", { ...state.books, standard })} />
        <NumberField label="大型本・雑誌" value={state.books.large} unit="冊" onChange={(large) => update("books", { ...state.books, large })} />
      </div>
    );
  };

  const renderStorageInputs = () => {
    if (state.category === "shoes") {
      return (
        <div className="storage-fields">
          <NumberField label="棚の内寸幅" value={state.shoes.width} unit="mm" step={50} onChange={(width) => update("shoes", { ...state.shoes, width })} />
          <NumberField label="内寸奥行き" value={state.shoes.depth} unit="mm" step={10} onChange={(depth) => update("shoes", { ...state.shoes, depth })} />
          <NumberField label="収納できる段数" value={state.shoes.levels} unit="段" onChange={(levels) => update("shoes", { ...state.shoes, levels })} />
        </div>
      );
    }
    if (state.category === "clothes") {
      return (
        <div className="storage-fields">
          <NumberField label="パイプの有効長さ" value={state.clothes.pipe} unit="mm" step={50} onChange={(pipe) => update("clothes", { ...state.clothes, pipe })} />
          <NumberField label="引き出し・ケース" value={state.clothes.drawers} unit="段" onChange={(drawers) => update("clothes", { ...state.clothes, drawers })} />
        </div>
      );
    }
    return (
      <div className="storage-fields">
        <NumberField label="棚の内寸幅" value={state.books.width} unit="mm" step={50} onChange={(width) => update("books", { ...state.books, width })} />
        <NumberField label="内寸奥行き" value={state.books.depth} unit="mm" step={10} onChange={(depth) => update("books", { ...state.books, depth })} />
        <NumberField label="収納できる段数" value={state.books.levels} unit="段" onChange={(levels) => update("books", { ...state.books, levels })} />
      </div>
    );
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#" aria-label="しまえる？ トップ">
          <span className="brand-mark">し</span>
          <span>しまえる？</span>
        </a>
        <p>用途別収納サイズシミュレーター</p>
      </header>

      <section className="hero">
        <p className="eyebrow">STORAGE SIZE GUIDE</p>
        <h1>いくつある？<br /><em>どれくらい必要？</em></h1>
        <p>持ち物の数から、ちょうどいい収納を。<br />収納のサイズが決まっていれば、十分に収まるか確認できます。</p>
        <div className="hero-shelf" aria-hidden="true">
          <span>▰</span><span>▥</span><span>▰</span><span>▥</span><span>▰</span>
        </div>
      </section>

      <section className="simulator">
        <div className="step-heading">
          <span>01</span>
          <div>
            <h2>何を収納しますか？</h2>
            <p>数が増減しやすいものから選べます</p>
          </div>
        </div>
        <div className="category-tabs">
          {(Object.keys(categoryInfo) as Category[]).map((category) => (
            <button
              type="button"
              key={category}
              className={state.category === category ? "active" : ""}
              onClick={() => update("category", category)}
            >
              <i>{categoryInfo[category].icon}</i>
              <b>{categoryInfo[category].label}</b>
              <small>{categoryInfo[category].description}</small>
            </button>
          ))}
        </div>

        <div className="workspace">
          <section className="input-panel">
            <div className="step-heading compact">
              <span>02</span>
              <div>
                <h2>持ち物の数</h2>
                <p>だいたいの数でも試せます</p>
              </div>
            </div>
            {renderInputs()}

            <div className="mode-block">
              <div className="step-heading compact">
                <span>03</span>
                <div>
                  <h2>収納のサイズ</h2>
                  <p>決まっていなくても大丈夫です</p>
                </div>
              </div>
              <div className="mode-options">
                <button type="button" className={state.storageMode === "unknown" ? "selected" : ""} onClick={() => update("storageMode", "unknown")}>
                  <b>まだ決まっていない</b>
                  <small>必要なサイズを知りたい</small>
                </button>
                <button type="button" className={state.storageMode === "known" ? "selected" : ""} onClick={() => update("storageMode", "known")}>
                  <b>サイズが決まっている</b>
                  <small>十分に収まるか知りたい</small>
                </button>
              </div>
              {state.storageMode === "known" && renderStorageInputs()}
            </div>

            <label className="margin-field">
              <span><b>増える分・出し入れの余裕</b><small>{state.margin}%</small></span>
              <input type="range" min="0" max="30" step="5" value={state.margin} onChange={(event) => update("margin", Number(event.target.value))} />
              <span className="range-labels"><small>ぴったり</small><small>ゆったり</small></span>
            </label>
          </section>

          <section className="result-column">
            <div className={`result-card ${state.storageMode === "known" && !result.fit ? "shortage" : ""}`} ref={resultRef}>
              <div className="result-brand">しまえる？ <span>収納サイズ診断</span></div>
              <p className="result-type">{categoryInfo[state.category].label}の結果</p>
              <h2>{result.title}</h2>
              <strong>{result.main}</strong>
              {result.usage !== null && (
                <div className="usage">
                  <div><span>収納使用率</span><b>{result.usage}%</b></div>
                  <div className="usage-track"><i style={{ width: `${Math.min(100, result.usage)}%` }} /></div>
                </div>
              )}
              <div className={`storage-visual visual-${result.graphic.kind}`} aria-label="収納量のイメージ">
                {Array.from({ length: Math.min(8, Math.max(3, result.graphic.units)) }).map((_, index, all) => (
                  <span key={index} className={index / all.length * 100 < result.graphic.filled ? "filled" : ""}>
                    {result.graphic.kind === "shoes" ? "⌁  ⌁  ⌁" : result.graphic.kind === "books" ? "▥ ▥ ▥ ▥" : "♧ ♧ ♧"}
                  </span>
                ))}
              </div>
              <p className="result-note">{result.note}</p>
              <div className="result-details">
                {result.details.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
              <p className="result-disclaimer">一般的な持ち物寸法から算出した目安です。実際の内寸や収納方法によって変わります。</p>
            </div>

            <div className="share-panel">
              <h3>この結果を家族と相談する</h3>
              <button type="button" className="share-primary" onClick={() => void shareResult()}>共有メニューを開く</button>
              <div>
                <button type="button" onClick={() => void saveImage()}>画像を保存</button>
                <button type="button" onClick={shareToX}>Xで共有</button>
              </div>
              {message && <p role="status">{message}</p>}
            </div>
          </section>
        </div>
      </section>

      <footer>
        <b>しまえる？</b>
        <span>数えて、測って、ちょうどよく。</span>
      </footer>
    </main>
  );
}
