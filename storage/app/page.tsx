"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

type Category = "shoes" | "clothes" | "books";
type StorageMode = "unknown" | "partial" | "known";
type ClothingLayout = "auto" | "side" | "below" | "split";
type DimensionKey = "width" | "height" | "depth";

type Dimensions = Record<DimensionKey, number> & Record<`${DimensionKey}Unknown`, boolean>;
type AppState = {
  category: Category;
  storageMode: StorageMode;
  shoes: { adult: number; child: number; boots: number };
  clothes: { hanger: number; heavy: number; folded: number };
  books: { paperback: number; standard: number; large: number };
  dimensions: Dimensions;
  clothingLayout: ClothingLayout;
  margin: number;
};

const initialState: AppState = {
  category: "clothes",
  storageMode: "unknown",
  shoes: { adult: 16, child: 6, boots: 2 },
  clothes: { hanger: 35, heavy: 8, folded: 50 },
  books: { paperback: 80, standard: 45, large: 15 },
  dimensions: { width: 900, height: 1800, depth: 350, widthUnknown: false, heightUnknown: true, depthUnknown: true },
  clothingLayout: "auto",
  margin: 15,
};

const categoryInfo: Record<Category, { label: string; description: string }> = {
  clothes: { label: "衣類", description: "掛ける・たたむを分けて計算" },
  shoes: { label: "靴", description: "靴棚の幅と高さを考える" },
  books: { label: "書籍", description: "本棚の幅と高さを考える" },
};
const categoryOrder: Category[] = ["clothes", "shoes", "books"];

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
    let clothingAllocation: { layout: "side" | "below" | "split"; layoutLabel: string; reason: string; pipeLength: number; regularPipe: number; coatPipe: number; hangingHeight: number; drawerHeight: number; drawerWidth: number; drawers: number; drawerColumns: number; drawerRows: number; manual: boolean; shortageText: string | null; alternativeLayout: string | null } | null = null;

    if (state.category === "shoes") {
      const { adult, child, boots } = state.shoes;
      count = adult + child + boots;
      unit = "足";
      requiredLength = (adult * 220 + child * 170 + boots * 240) * marginFactor;
      rowHeight = boots ? 240 : 200;
      recommended = { width: 900, height: Math.max(900, Math.ceil(requiredLength / 900) * rowHeight + 100), depth: boots ? 350 : 320 };
      details = [`大人用 ${adult}足`, `子ども用 ${child}足`, `ブーツ ${boots}足`];
      extraNote = "";
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
      const regularPipe = hanger > 0 ? Math.max(600, roundUp(hanger * 35 * marginFactor, 100)) : 0;
      const coatPipe = heavy > 0 ? Math.max(600, roundUp(heavy * 65 * marginFactor, 100)) : 0;
      const pipeLength = regularPipe + coatPipe;
      const drawers = folded > 0 ? Math.max(1, Math.ceil((folded * marginFactor) / 18)) : 0;
      const makeDrawers = (maxRows: number) => {
        const columns = drawers > 0 ? Math.ceil(drawers / maxRows) : 0;
        return { columns, rows: columns > 0 ? Math.ceil(drawers / columns) : 0, width: columns * 600 };
      };
      const sideDrawers = makeDrawers(6);
      const belowDrawers = makeDrawers(heavy > 0 ? 1 : 2);
      const splitDrawers = makeDrawers(2);
      const hangingHeight = heavy > 0 ? 1550 : 1200;
      const candidates = [
        { layout: "side" as const, layoutLabel: "横並び", reason: "吊るす収納と引き出しを左右に分ける、わかりやすい配置です。", width: Math.max(600, pipeLength + sideDrawers.width), height: roundUp(Math.max(hangingHeight, sideDrawers.rows * 220 + 200), 50), hangingHeight, drawers: sideDrawers },
        { layout: "below" as const, layoutLabel: "パイプ下に引き出し", reason: "パイプと引き出しを上下に重ね、横幅を抑える配置です。", width: Math.max(600, pipeLength, belowDrawers.width), height: roundUp(hangingHeight + belowDrawers.rows * 220, 50), hangingHeight, drawers: belowDrawers },
        { layout: "split" as const, layoutLabel: "シャツ下＋コート分離", reason: "短い衣類の下に引き出しを置き、丈の長い衣類だけを隣に分ける配置です。", width: Math.max(600, Math.max(regularPipe, splitDrawers.width) + coatPipe), height: roundUp(Math.max(1550, 1200 + splitDrawers.rows * 220), 50), hangingHeight: 1200, drawers: splitDrawers },
      ].filter((candidate) => candidate.layout !== "split" || (hanger > 0 && heavy > 0 && drawers > 0));
      const fixedWidth = !dimensionUnknown("width") ? d.width : null;
      const fixedHeight = !dimensionUnknown("height") ? d.height : null;
      const fixedDepth = !dimensionUnknown("depth") ? d.depth : null;
      const score = (candidate: typeof candidates[number]) => {
        const overflow = Math.max(0, candidate.width - (fixedWidth ?? candidate.width)) * 5 + Math.max(0, candidate.height - (fixedHeight ?? candidate.height)) * 5 + Math.max(0, 600 - (fixedDepth ?? 600)) * 5;
        return overflow + candidate.width + Math.max(0, candidate.height - 2000) * 3;
      };
      const isCompatible = (candidate: typeof candidates[number]) => (fixedWidth === null || candidate.width <= fixedWidth) && (fixedHeight === null || candidate.height <= fixedHeight) && (fixedDepth === null || 600 <= fixedDepth);
      const autoCandidates = candidates.filter((candidate) => candidate.layout !== "below" || fixedHeight === null || candidate.height <= fixedHeight);
      const compatibleCandidates = autoCandidates.filter(isCompatible);
      const autoChosen = [...(compatibleCandidates.length > 0 ? compatibleCandidates : autoCandidates)].sort((a, b) => score(a) - score(b))[0];
      const requested = state.clothingLayout !== "auto" ? candidates.find((candidate) => candidate.layout === state.clothingLayout) : null;
      const manual = Boolean(requested);
      const chosen = requested ?? autoChosen;
      const belowCandidate = candidates.find((candidate) => candidate.layout === "below");
      const shortages = [
        fixedWidth !== null && chosen.width > fixedWidth ? `幅が${chosen.width - fixedWidth}mm不足` : null,
        fixedHeight !== null && chosen.height > fixedHeight ? `高さが${chosen.height - fixedHeight}mm不足` : null,
        fixedDepth !== null && 600 > fixedDepth ? `奥行きが${600 - fixedDepth}mm不足` : null,
      ].filter(Boolean) as string[];
      const alternative = [...candidates].filter((candidate) => candidate.layout !== chosen.layout && isCompatible(candidate)).sort((a, b) => score(a) - score(b))[0];
      const lowHeightReason = manual && shortages.length > 0
        ? `指定した配置には${shortages.join("・")}しています。${alternative ? `「${alternative.layoutLabel}」なら現在の固定寸法に収まります。` : "固定した寸法の変更が必要です。"}`
        : manual ? `指定した「${chosen.layoutLabel}」で割り付けます。${chosen.reason}`
        : fixedHeight !== null && belowCandidate && belowCandidate.height > fixedHeight && chosen.layout !== "below"
        ? `高さ${fixedHeight}mmでは上下配置に必要な${belowCandidate.height}mmを確保できないため、必要高さが増えにくい横並びを選びます。`
        : chosen.reason;
      clothingAllocation = { layout: chosen.layout, layoutLabel: chosen.layoutLabel, reason: lowHeightReason, pipeLength, regularPipe, coatPipe, hangingHeight: chosen.hangingHeight, drawerHeight: chosen.drawers.rows * 220, drawerWidth: chosen.drawers.width, drawers, drawerColumns: chosen.drawers.columns, drawerRows: chosen.drawers.rows, manual, shortageText: shortages.length > 0 ? shortages.join("・") : null, alternativeLayout: alternative?.layoutLabel ?? null };
      recommended = { width: chosen.width, height: chosen.height, depth: 600 };
      requiredLength = pipeLength;
      details = [`ハンガー ${hanger}着`, `コート・厚手 ${heavy}着`, `たたむ衣類 ${folded}着`];
      extraNote = `${manual ? "選択した配置" : "おすすめ"}は「${chosen.layoutLabel}」です。${lowHeightReason}`;
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
      count,
      unit,
      capacityCount,
      overflowCount: Math.max(0, count - capacityCount),
      spareCount: Math.max(0, capacityCount - count),
      output,
      levels,
      clothingAllocation,
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
    const xWindow = forX ? window.open("about:blank", "_blank") : null;
    const blob = await createResultImage();
    if (!blob) {
      xWindow?.close();
      return;
    }
    const file = new File([blob], "shimaeru-result.png", { type: "image/png" });
    const text = `${result.title}。${result.main}\n#しまえる #収納 #ななふしの家`;
    try {
      if (forX) {
        downloadBlob(blob);
        const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
        if (xWindow) xWindow.location.href = xUrl;
        else window.open(xUrl, "_blank", "noopener,noreferrer");
        setMessage("結果画像を保存し、Xの投稿画面を開きました。保存した画像を添付してください");
        return;
      }
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "しまえる？", text, files: [file] });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage("共有文をコピーしました。画像は保存ボタンから保存できます");
    } catch (error) {
      xWindow?.close();
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

  const renderClothingLayoutOptions = () => {
    const options: Array<{ value: ClothingLayout; label: string; description: string; disabled?: boolean }> = [
      { value: "auto", label: "おまかせ", description: "寸法に合う配置を自動選択" },
      { value: "side", label: "横並び", description: "高さを抑えやすい" },
      { value: "below", label: "パイプ下に引き出し", description: "横幅を抑えやすい" },
      { value: "split", label: "シャツ下＋コート分離", description: "丈の違いを活用", disabled: !(state.clothes.hanger > 0 && state.clothes.heavy > 0 && state.clothes.folded > 0) },
    ];
    const layoutIcon = (layout: ClothingLayout) => <span className={`layout-icon icon-${layout}`} aria-hidden="true"><i /><i /><i /></span>;
    return <div className="layout-selector"><div><b>収納レイアウト</b><small>収納内部の構成を選べます</small></div><div className="layout-options">{options.map((option) => <button type="button" key={option.value} disabled={option.disabled} className={state.clothingLayout === option.value ? "selected" : ""} aria-pressed={state.clothingLayout === option.value} onClick={() => update("clothingLayout", option.value)}>{layoutIcon(option.value)}<span className="layout-option-copy"><b>{option.label}</b><small>{option.disabled ? "3種類の衣類がある場合に選択可" : option.description}</small></span></button>)}</div></div>;
  };

  const renderStorageDiagram = () => {
    const widthCalculated = result.dimensions.find((item) => item.key === "width")?.calculated;
    const heightCalculated = result.dimensions.find((item) => item.key === "height")?.calculated;
    const depthCalculated = result.dimensions.find((item) => item.key === "depth")?.calculated;

    if (state.category === "clothes") {
      const allocation = result.clothingAllocation!;
      const drawerBlocks = Array.from({ length: Math.min(6, allocation.drawers) }).map((_, index) => <span key={index} />);
      const shirtIcons = Array.from({ length: 3 }).map((_, index) => <img key={`shirt-${index}`} className="shirt-side" src={`${import.meta.env.BASE_URL}icons/shirt-side.png`} alt="" aria-hidden="true" />);
      const coatIcons = Array.from({ length: 2 }).map((_, index) => <img key={`coat-${index}`} className="coat-side" src={`${import.meta.env.BASE_URL}icons/coat-side.png`} alt="" aria-hidden="true" />);
      const hangingIcons = state.clothes.heavy > 0 ? [...shirtIcons.slice(0, 2), ...coatIcons] : shirtIcons;
      const clothesLayout = allocation.layout === "split" ? (
        <>
          <div className="regular-stack" style={{ flex: Math.max(1, Math.max(allocation.regularPipe, allocation.drawerWidth)) }}>
            <div className="hanger-zone regular-hanger"><span className="rail" />{shirtIcons}<small>シャツ用 {allocation.regularPipe}mm・高さ {allocation.hangingHeight}mm</small></div>
            <div className="drawer-zone stacked-drawers">{drawerBlocks}<small>引き出し 幅{allocation.drawerWidth} × 高さ{allocation.drawerHeight}mm</small></div>
          </div>
          <div className="hanger-zone coat-zone" style={{ flex: Math.max(1, allocation.coatPipe) }}><span className="rail" />{coatIcons}<small>コート用 {allocation.coatPipe}mm</small></div>
        </>
      ) : allocation.layout === "below" ? (
        <div className="regular-stack full-stack"><div className="hanger-zone regular-hanger"><span className="rail" />{hangingIcons}<small>パイプ {allocation.pipeLength}mm・有効高さ {allocation.hangingHeight}mm</small></div><div className="drawer-zone stacked-drawers">{drawerBlocks}<small>引き出し 幅{allocation.drawerWidth} × 高さ{allocation.drawerHeight}mm</small></div></div>
      ) : (
        <><div className="hanger-zone"><span className="rail" />{hangingIcons}<small>パイプ {allocation.pipeLength}mm</small></div><div className="drawer-zone">{drawerBlocks}<small>引き出し幅 {allocation.drawerWidth}mm</small></div></>
      );
      return (
        <div className="elevation-wrap">
          <div className={`dimension-line dimension-height ${heightCalculated ? "calculated" : "fixed"}`}><b>{result.output.height}</b><small>mm</small></div>
          <div className={`storage-elevation clothes-elevation layout-${allocation.layout}`} style={allocation.layout === "side" ? { gridTemplateColumns: `${Math.max(1, allocation.pipeLength)}fr ${Math.max(1, allocation.drawerWidth)}fr` } : undefined}>{clothesLayout}</div>
          <div className={`dimension-line dimension-width ${widthCalculated ? "calculated" : "fixed"}`}><b>{result.output.width}</b><small>mm</small></div>
          <div className={`depth-label ${depthCalculated ? "calculated" : "fixed"}`}>奥行き {result.output.depth}mm</div>
          <div className="diagram-summary">ハンガー {state.clothes.hanger + state.clothes.heavy}着・たたむ衣類 {state.clothes.folded}着</div>
        </div>
      );
    }

    const rows = Math.min(6, Math.max(2, result.levels));
    const slots = rows * 4;
    const filledSlots = Math.min(slots, Math.ceil((result.graphic.filled / 100) * slots));
    const icon = state.category === "shoes" ? "shoes" : "books";

    return (
      <div className="elevation-wrap">
        <div className={`dimension-line dimension-height ${heightCalculated ? "calculated" : "fixed"}`}><b>{result.output.height}</b><small>mm</small></div>
        <div className={`storage-elevation shelf-elevation ${!result.fit ? "has-overflow" : ""}`}>
          {Array.from({ length: rows }).map((_, row) => (
            <div className="elevation-shelf-row" key={row}>
              {Array.from({ length: 4 }).map((__, slot) => {
                const filled = row * 4 + slot < filledSlots;
                return <span key={slot} className={filled ? "occupied" : "empty-slot"}>{filled && <img src={`${import.meta.env.BASE_URL}icons/${icon}.png`} alt="" aria-hidden="true" />}</span>;
              })}
            </div>
          ))}
        </div>
        <div className={`dimension-line dimension-width ${widthCalculated ? "calculated" : "fixed"}`}><b>{result.output.width}</b><small>mm</small></div>
        <div className={`depth-label ${depthCalculated ? "calculated" : "fixed"}`}>奥行き {result.output.depth}mm</div>
        <div className="diagram-summary">{result.count}{result.unit}を収納{result.fit ? `・約${result.spareCount}${result.unit}分の空き` : `・約${result.overflowCount}${result.unit}が収納外`}</div>
        {!result.fit && <div className="overflow-items"><b>収納外</b>{Array.from({ length: Math.min(4, Math.max(1, result.overflowCount)) }).map((_, index) => <img key={index} src={`${import.meta.env.BASE_URL}icons/${icon}.png`} alt="" aria-hidden="true" />)}</div>}
      </div>
    );
  };

  return (
    <main>
      <header className="site-header"><a className="brand" href="#" aria-label="しまえる？ トップ"><span className="brand-mark">し</span><span>しまえる？</span></a><p>用途別収納サイズシミュレーター</p></header>

      <section className="hero">
        <picture>
          <source media="(max-width: 620px)" srcSet={`${import.meta.env.BASE_URL}cover-mobile.png`} />
          <img src={`${import.meta.env.BASE_URL}cover-desktop.png`} alt="しまえる？ 持ち物から、ちょうどいい収納を。用途別収納サイズシミュレーター" />
        </picture>
        <p className="cover-description">靴・衣類・書籍の数から、必要な収納の幅・高さ・奥行きを計算できます。収納サイズが決まっている場合は、持ち物が十分に収まるかも確認できます。</p>
      </section>

      <section className="simulator">
        <div className="step-heading"><span>01</span><div><h2>何を収納しますか？</h2><p>数が増減しやすいものから選べます</p></div></div>
        <div className="category-tabs">
          {categoryOrder.map((category) => <button type="button" key={category} className={state.category === category ? "active" : ""} onClick={() => update("category", category)}><img src={`${import.meta.env.BASE_URL}icons/${category}.png`} alt="" aria-hidden="true" /><b>{categoryInfo[category].label}</b><small>{categoryInfo[category].description}</small></button>)}
        </div>

        <div className="workspace">
          <div className="step-heading"><span>02</span><div><h2>持ち物の数</h2><p>だいたいの数でも試せます</p></div></div>
          <section className="input-panel inventory-panel">{renderInputs()}</section>

          <div className="step-heading"><span>03</span><div><h2>収納のサイズ</h2><p>決まっている範囲を教えてください</p></div></div>
          <section className="input-panel storage-panel">
            <div className="mode-options">
              <button type="button" className={state.storageMode === "unknown" ? "selected" : ""} onClick={() => update("storageMode", "unknown")}><b>決まっていない</b><small>必要な3寸法を知りたい</small></button>
              <button type="button" className={state.storageMode === "partial" ? "selected" : ""} onClick={() => update("storageMode", "partial")}><b>部分的に決まっている</b><small>未定の寸法だけ知りたい</small></button>
              <button type="button" className={state.storageMode === "known" ? "selected" : ""} onClick={() => update("storageMode", "known")}><b>すべて決まっている</b><small>十分に収まるか知りたい</small></button>
            </div>
            {state.storageMode !== "unknown" && renderStorageInputs()}
            {state.category === "clothes" && renderClothingLayoutOptions()}
            <label className="margin-field"><span><b>増える分・出し入れの余裕</b><small>{state.margin}%</small></span><input type="range" min="0" max="30" step="5" value={state.margin} onChange={(event) => update("margin", Number(event.target.value))} /><span className="range-labels"><small>ぴったり</small><small>ゆったり</small></span></label>
          </section>

          <section className="result-column">
            <div className={`result-card ${!result.fit ? "shortage" : ""}`} ref={resultRef}>
              <div className="result-brand">しまえる？ <span>収納サイズ診断</span></div>
              <p className="result-type">{categoryInfo[state.category].label}の結果</p>
              <h2>{result.title}</h2><strong>{result.main}</strong>
              {result.usage !== null && <div className="usage"><div><span>収納使用率</span><b>{result.usage}%</b></div><div className="usage-track"><i style={{ width: `${Math.min(100, result.usage)}%` }} /></div></div>}
              {state.storageMode !== "known" && <div className="dimension-result">{result.dimensions.map((dimension) => <div key={dimension.key} className={dimension.calculated ? "calculated" : "fixed"}><small>{dimension.label}{dimension.calculated ? "（算出）" : "（固定）"}</small><b>{dimension.value}<span>mm</span></b></div>)}</div>}
              {state.category === "clothes" && result.clothingAllocation && <><div className={`layout-recommendation ${result.clothingAllocation.shortageText ? "layout-warning" : ""}`}><small>{result.clothingAllocation.manual ? "選択した割り付け" : "おすすめの割り付け"}</small><b>{result.clothingAllocation.layoutLabel}</b><p>{result.clothingAllocation.reason}</p></div><div className="clothing-allocation"><div><small>吊るす収納</small><b>パイプ合計 {result.clothingAllocation.pipeLength}<span>mm</span></b><p>{result.clothingAllocation.layout === "split" ? `シャツ用${result.clothingAllocation.regularPipe}mm・コート用${result.clothingAllocation.coatPipe}mm` : `${state.clothes.hanger + state.clothes.heavy}着分`}</p></div><div><small>たたむ収納</small><b>引き出し幅 {result.clothingAllocation.drawerWidth}<span>mm</span></b><p>{result.clothingAllocation.drawers}段を{result.clothingAllocation.drawerColumns}列 × 最大{result.clothingAllocation.drawerRows}段で配置</p></div></div>{result.clothingAllocation.layout === "below" && <div className="height-allocation"><span><small>吊るす部分の有効高さ</small><b>{result.clothingAllocation.hangingHeight}mm</b></span><i>＋</i><span><small>引き出し部分の高さ</small><b>{result.clothingAllocation.drawerHeight}mm</b></span><i>＝</i><span><small>必要な全体高さ</small><b>{result.clothingAllocation.hangingHeight + result.clothingAllocation.drawerHeight}mm</b></span></div>}</>}
              {renderStorageDiagram()}
              <p className="result-note">{result.note}</p>
              <div className="result-details">{result.details.map((detail) => <span key={detail}>{detail}</span>)}</div>
              <div className="share-hashtags">#しまえる　#収納　#ななふしの家</div>
              <p className="result-disclaimer">一般的な持ち物寸法から算出した目安です。実際の内寸や収納方法によって変わります。</p>
            </div>
            <div className="share-panel"><h3>結果を共有する</h3><button type="button" className="share-primary" onClick={() => void shareResult()}><img src={`${import.meta.env.BASE_URL}icons/share.png`} alt="" aria-hidden="true" />画像付きで共有</button><div><button type="button" onClick={() => void saveImage()}><img src={`${import.meta.env.BASE_URL}icons/save-image.png`} alt="" aria-hidden="true" />画像を保存</button><button type="button" onClick={() => void shareResult(true)}><img src={`${import.meta.env.BASE_URL}icons/x-share.png`} alt="" aria-hidden="true" />Xへ画像を共有</button></div>{message && <p role="status">{message}</p>}</div>
          </section>
        </div>
      </section>
      <aside className="operator-profile" aria-labelledby="operator-profile-title"><img src={`${import.meta.env.BASE_URL}nanafushi-profile.webp`} alt="草木に囲まれたななふしと家のイラスト"/><div><p className="operator-label">運営者プロフィール</p><h2 id="operator-profile-title">ななふし</h2><p>IT系研究職・2児の父として、一級建築士の妻とともに注文住宅づくりを検討中。</p><p>noteでは、家づくりの検討過程を、できるだけ感覚だけでなく「なぜそう考えたか」まで整理して発信しています。</p><a href="https://note.com/nanafushi_ie" target="_blank" rel="noopener noreferrer">ななふしの家づくりをnoteで読む <span aria-hidden="true">↗</span></a></div></aside>
      <footer><b>しまえる？</b><span>数えて、測って、ちょうどよく。</span></footer>
    </main>
  );
}
