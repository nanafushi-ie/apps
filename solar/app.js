const PREFECTURES = [
  ["北海道", 1010], ["青森県", 980], ["岩手県", 1080], ["宮城県", 1050],
  ["秋田県", 950], ["山形県", 1030], ["福島県", 1110], ["茨城県", 1160],
  ["栃木県", 1160], ["群馬県", 1210], ["埼玉県", 1140], ["千葉県", 1130],
  ["東京都", 1090], ["神奈川県", 1110], ["新潟県", 1000], ["富山県", 1020],
  ["石川県", 1010], ["福井県", 1040], ["山梨県", 1260], ["長野県", 1220],
  ["岐阜県", 1150], ["静岡県", 1210], ["愛知県", 1190], ["三重県", 1190],
  ["滋賀県", 1090], ["京都府", 1080], ["大阪府", 1130], ["兵庫県", 1140],
  ["奈良県", 1130], ["和歌山県", 1200], ["鳥取県", 1050], ["島根県", 1060],
  ["岡山県", 1200], ["広島県", 1160], ["山口県", 1150], ["徳島県", 1210],
  ["香川県", 1210], ["愛媛県", 1190], ["高知県", 1260], ["福岡県", 1120],
  ["佐賀県", 1150], ["長崎県", 1130], ["熊本県", 1190], ["大分県", 1190],
  ["宮崎県", 1270], ["鹿児島県", 1210], ["沖縄県", 1190]
];

const COLORS = { none: "#86918e", solar: "#e8a51d", battery: "#24745f" };
const YEARS = 30;
const TOP_PAGE_URL = window.location.href.split("?")[0].split("#")[0];
const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const compactYen = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

const $ = (id) => document.getElementById(id);
const form = $("simulatorForm");
const chart = $("costChart");
const chartCtx = chart.getContext("2d");
const shareCanvas = $("shareCanvas");
const shareCtx = shareCanvas.getContext("2d");
let latest = null;
let chartGeometry = null;

function fillPrefectures() {
  $("prefecture").innerHTML = [
    '<option value="" selected>都道府県を選択</option>',
    ...PREFECTURES.map(
      ([name, yieldValue]) =>
        `<option value="${name}" data-yield="${yieldValue}">${name}</option>`
    )
  ].join("");
}

function numberValue(id) {
  return Number($(id).value) || 0;
}

function getInputs() {
  const selected = $("prefecture").selectedOptions[0];
  return {
    prefecture: selected.value,
    regionalYield: Number(selected.dataset.yield),
    usage: numberValue("annualUsage"),
    electricityPrice: numberValue("electricityPrice"),
    priceGrowth: numberValue("priceGrowth") / 100,
    panelCapacity: numberValue("panelCapacity"),
    solarCost: numberValue("solarCost"),
    solarSubsidy: numberValue("solarSubsidy"),
    degradation: numberValue("panelDegradation") / 100,
    roofFactor: numberValue("roofDirection"),
    solarSelf: numberValue("selfConsumption") / 100,
    includeBattery: $("includeBattery").checked,
    batteryCost: numberValue("batteryCost"),
    batterySubsidy: numberValue("batterySubsidy"),
    batterySelf: numberValue("batteryConsumption") / 100,
    batteryReplacementYear: numberValue("batteryReplacementYear"),
    batteryReplacementCost: numberValue("batteryReplacementCost"),
    fitEarly: numberValue("fitEarly"),
    fitLate: numberValue("fitLate"),
    postFit: numberValue("postFit"),
    inverterYear: numberValue("inverterYear"),
    inverterCost: numberValue("inverterCost")
  };
}

const SOLAR_PRESET = {
  panelCapacity: 5,
  solarCost: 1400000,
  solarSubsidy: 100000,
  panelDegradation: 0.5,
  roofDirection: 1,
  selfConsumption: 30
};

const BATTERY_PRESET = {
  batteryCost: 1500000,
  batterySubsidy: 300000,
  batteryConsumption: 70,
  batteryReplacementYear: 15,
  batteryReplacementCost: 1000000
};

function setPresetValues(values) {
  Object.entries(values).forEach(([id, value]) => {
    $(id).value = String(value);
  });
}

function setSectionLocked(sectionId, locked, excludedIds) {
  const section = $(sectionId);
  section.classList.toggle("preset-locked", locked);
  section.querySelectorAll("input, select").forEach((control) => {
    if (excludedIds.includes(control.id)) return;
    control.disabled = locked;
  });
}

function applyPresetState() {
  const solarPresetEnabled = $("solarPreset").checked;
  if (solarPresetEnabled) {
    setPresetValues(SOLAR_PRESET);
    const lifestyleValue = Number($("daytimeLifestyle").value);
    if (Number.isFinite(lifestyleValue)) {
      $("selfConsumption").value = String(lifestyleValue);
    } else {
      $("daytimeLifestyle").value = "30";
    }
  }
  if ($("batteryPreset").checked) setPresetValues(BATTERY_PRESET);
  setSectionLocked("solarSettings", solarPresetEnabled, ["solarPreset", "daytimeLifestyle"]);
  setSectionLocked(
    "batterySettings",
    $("batteryPreset").checked,
    ["includeBattery", "batteryPreset"]
  );
}

function salePrice(inputs, year) {
  if (year <= 4) return inputs.fitEarly;
  if (year <= 10) return inputs.fitLate;
  return inputs.postFit;
}

function planYearCost(inputs, year, selfRate, battery) {
  const generation =
    inputs.panelCapacity *
    inputs.regionalYield *
    inputs.roofFactor *
    Math.pow(1 - inputs.degradation, year - 1);
  const selfUsed = Math.min(generation * selfRate, inputs.usage);
  const sold = Math.max(generation - selfUsed, 0);
  const bought = Math.max(inputs.usage - selfUsed, 0);
  const unitPrice = inputs.electricityPrice * Math.pow(1 + inputs.priceGrowth, year - 1);
  let maintenance = year === inputs.inverterYear ? inputs.inverterCost : 0;
  if (battery && year === inputs.batteryReplacementYear) {
    maintenance += inputs.batteryReplacementCost;
  }
  return {
    generation,
    selfUsed,
    sold,
    bought,
    unitPrice,
    saleIncome: sold * salePrice(inputs, year),
    maintenance,
    cost: bought * unitPrice - sold * salePrice(inputs, year) + maintenance
  };
}

function crossing(seriesA, seriesB) {
  const crossings = [];
  for (let i = 1; i < seriesA.length; i++) {
    const before = seriesA[i - 1] - seriesB[i - 1];
    const now = seriesA[i] - seriesB[i];
    if (before > 0 && now <= 0) {
      const fraction = before / (before - now);
      crossings.push(i - 1 + fraction);
    }
  }
  if (!crossings.length) return { first: null, final: null };
  let final = crossings[crossings.length - 1];
  for (const candidate of crossings) {
    const index = Math.ceil(candidate);
    if (seriesA.slice(index).every((value, offset) => value <= seriesB[index + offset])) {
      final = candidate;
      break;
    }
  }
  return { first: crossings[0], final };
}

function calculate() {
  const inputs = getInputs();
  const data = [];
  let noSolar = 0;
  let solar = Math.max(inputs.solarCost - inputs.solarSubsidy, 0);
  let battery =
    solar + Math.max(inputs.batteryCost - inputs.batterySubsidy, 0);

  data.push({
    year: 0,
    generation: 0,
    noSolar,
    solar,
    battery,
    solarDetail: null,
    batteryDetail: null
  });

  for (let year = 1; year <= YEARS; year++) {
    const unitPrice = inputs.electricityPrice * Math.pow(1 + inputs.priceGrowth, year - 1);
    noSolar += inputs.usage * unitPrice;
    const solarDetail = planYearCost(inputs, year, inputs.solarSelf, false);
    const batteryDetail = planYearCost(inputs, year, inputs.batterySelf, true);
    solar += solarDetail.cost;
    battery += batteryDetail.cost;
    data.push({
      year,
      generation: solarDetail.generation,
      noSolar,
      solar,
      battery,
      solarDetail,
      batteryDetail
    });
  }

  const noSeries = data.map((row) => row.noSolar);
  const solarSeries = data.map((row) => row.solar);
  const batterySeries = data.map((row) => row.battery);
  return {
    inputs,
    data,
    solarCrossing: crossing(solarSeries, noSeries),
    batteryCrossing: crossing(batterySeries, noSeries),
    batteryVsSolar: crossing(batterySeries, solarSeries)
  };
}

function formatMoney(value) {
  return `${yen.format(Math.round(value))}円`;
}

function formatBreakEven(value) {
  return value == null ? "30年以内になし" : `約${value.toFixed(1)}年`;
}

function renderSummary(result) {
  const last = result.data[result.data.length - 1];
  const cards = [
    { key: "none", label: "太陽光なし", value: last.noSolar, note: "30年間の累積支出" },
    {
      key: "solar",
      label: "太陽光パネルのみ",
      value: last.solar,
      note: `${formatBreakEven(result.solarCrossing.final)}で元が取れる見込み`
    }
  ];
  if (result.inputs.includeBattery) {
    cards.push({
      key: "battery",
      label: "太陽光＋蓄電池",
      value: last.battery,
      note: `${formatBreakEven(result.batteryCrossing.final)}で元が取れる見込み`
    });
  }
  $("summaryCards").innerHTML = cards
    .map(
      (card) => `<article class="summary-card ${card.key}">
        <small>${card.label}</small>
        <span class="summary-value-label">30年間のトータルコスト</span>
        <strong>${compactYen.format(card.value)}円</strong>
        <p>${card.note}</p>
      </article>`
    )
    .join("");
}

function resizeCanvas() {
  const rect = chart.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  chart.width = Math.round(rect.width * dpr);
  chart.height = Math.round(rect.height * dpr);
  chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
}

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderChart(result) {
  const size = resizeCanvas();
  const ctx = chartCtx;
  const padding = { top: 20, right: 18, bottom: 42, left: 58 };
  const plotW = size.width - padding.left - padding.right;
  const plotH = size.height - padding.top - padding.bottom;
  const keys = result.inputs.includeBattery ? ["noSolar", "solar", "battery"] : ["noSolar", "solar"];
  const maxValue = Math.max(...result.data.flatMap((row) => keys.map((key) => row[key]))) * 1.08;
  const x = (year) => padding.left + (year / YEARS) * plotW;
  const y = (value) => padding.top + plotH - (value / maxValue) * plotH;

  ctx.clearRect(0, 0, size.width, size.height);
  ctx.font = '10px "Avenir Next", sans-serif';
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 5; i++) {
    const value = (maxValue / 5) * i;
    const yy = y(value);
    ctx.strokeStyle = "#e6e8e2";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, yy);
    ctx.lineTo(size.width - padding.right, yy);
    ctx.stroke();
    ctx.fillStyle = "#7c8985";
    ctx.fillText(`${Math.round(value / 10000)}万`, padding.left - 9, yy);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  [0, 5, 10, 15, 20, 25, 30].forEach((year) => {
    ctx.fillStyle = "#7c8985";
    ctx.fillText(`${year}年`, x(year), size.height - padding.bottom + 13);
  });

  const paths = [
    ["noSolar", COLORS.none],
    ["solar", COLORS.solar]
  ];
  if (result.inputs.includeBattery) paths.push(["battery", COLORS.battery]);
  paths.forEach(([key, color]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    result.data.forEach((row, index) => {
      const px = x(row.year);
      const py = y(row[key]);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  const markers = [
    [result.solarCrossing.final, COLORS.solar],
    [result.inputs.includeBattery ? result.batteryCrossing.final : null, COLORS.battery]
  ];
  markers.forEach(([year, color]) => {
    if (year == null) return;
    const px = x(year);
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, padding.top + plotH);
    ctx.stroke();
    ctx.restore();
  });

  chartGeometry = { padding, plotW, plotH, maxValue, width: size.width, height: size.height };
  $("legend").innerHTML = [
    ["太陽光なし", COLORS.none],
    ["太陽光パネルのみ", COLORS.solar],
    ...(result.inputs.includeBattery ? [["蓄電池あり", COLORS.battery]] : [])
  ]
    .map(([label, color]) => `<span><i style="background:${color}"></i>${label}</span>`)
    .join("");
}

function renderEmptyChart() {
  const size = resizeCanvas();
  const ctx = chartCtx;
  const padding = { top: 24, right: 18, bottom: 42, left: 58 };
  const plotW = size.width - padding.left - padding.right;
  const plotH = size.height - padding.top - padding.bottom;
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.strokeStyle = "#e6e8e2";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (plotH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#8a9692";
  ctx.font = '600 13px "Hiragino Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("都道府県を選択するとグラフを表示します", size.width / 2, size.height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  chartGeometry = null;
  $("legend").innerHTML = "";
  $("chartTooltip").hidden = true;
}

function renderInsights(result) {
  const inputs = result.inputs;
  const last = result.data[result.data.length - 1];
  const solarSaving = last.noSolar - last.solar;
  if (result.solarCrossing.final == null) {
    $("breakEvenHeadline").textContent = "太陽光パネルのみでは30年以内には元が取れない見込みです";
    $("breakEvenText").textContent = `30年後に支払う合計金額の差は${formatMoney(Math.abs(solarSaving))}です。最初にかかる費用や発電量を見直してみてください。`;
  } else {
    $("breakEvenHeadline").textContent = `太陽光パネルのみでは約${result.solarCrossing.final.toFixed(1)}年で元が取れる見込みです`;
    $("breakEvenText").textContent = `30年後には太陽光なしと比べて、支払う合計金額が${formatMoney(solarSaving)}少ない試算です。`;
  }

  const batteryInsight = $("batteryInsight");
  batteryInsight.hidden = !inputs.includeBattery;
  if (inputs.includeBattery) {
    const batterySaving = last.noSolar - last.battery;
    if (result.batteryCrossing.final == null) {
      $("batteryBreakEvenHeadline").textContent = "30年以内には元が取れない見込みです";
      $("batteryBreakEvenText").textContent =
        `30年後に支払う合計金額の差は${formatMoney(Math.abs(batterySaving))}です。経済性とは別に、停電時の電源としての価値もあります。`;
    } else {
      $("batteryBreakEvenHeadline").textContent =
        `約${result.batteryCrossing.final.toFixed(1)}年で元が取れる見込みです`;
      $("batteryBreakEvenText").textContent =
        `30年後には太陽光なしと比べて${formatMoney(batterySaving)}少ない試算です。加えて、停電時に使える電気を確保する防災面のメリットがあります。`;
    }
  }
  $("batteryInsight").closest(".insight-grid").classList.toggle(
    "single-insight",
    !inputs.includeBattery
  );

  const initialGeneration = inputs.panelCapacity * inputs.regionalYield * inputs.roofFactor;
  $("generationHeadline").textContent = `発電量の参考：${inputs.prefecture}で年間約${yen.format(initialGeneration)}kWh。`;
  $("generationText").textContent =
    `地域の代表的な日射条件と屋根の向きによる概算で、目安の範囲は${yen.format(initialGeneration * 0.9)}〜${yen.format(initialGeneration * 1.1)}kWhです。`;
  $("regionNote").textContent = `地域係数：${yen.format(inputs.regionalYield)} kWh/kW・年（概算）`;
}

function renderTable(result) {
  $("yearlyTable").innerHTML = result.data
    .filter((row) => row.year > 0)
    .map(
      (row) => `<tr>
        <td>${row.year}年</td>
        <td>${yen.format(row.generation)} kWh</td>
        <td>${formatMoney(row.noSolar)}</td>
        <td>${formatMoney(row.solar)}</td>
        <td>${result.inputs.includeBattery ? formatMoney(row.battery) : "—"}</td>
      </tr>`
    )
    .join("");
}

function shareText(result) {
  const last = result.data[result.data.length - 1];
  const saving = last.noSolar - last.solar;
  const area = $("hideSharePrefecture").checked ? "" : `${result.inputs.prefecture}・`;
  return `${area}太陽光${result.inputs.panelCapacity.toFixed(1)}kWでシミュレーションしました。\n\n太陽光パネルのみで元が取れるまで：${formatBreakEven(result.solarCrossing.final)}\n30年後に減らせる金額：約${yen.format(Math.max(saving, 0) / 10000)}万円\n\n太陽光発電の導入効果をシミュレーションできます。\n${TOP_PAGE_URL}\n\n#ななふしの家 #太陽光発電 #住宅`;
}

function drawShareImage(result) {
  const ctx = shareCtx;
  const w = shareCanvas.width;
  const h = shareCanvas.height;
  const last = result.data[result.data.length - 1];
  const saving = Math.max(last.noSolar - last.solar, 0);
  const batterySaving = Math.max(last.noSolar - last.battery, 0);
  const ink = "#193b31";
  const orange = "#df7e3a";
  const sage = "#9cab8d";
  const paper = "#f5f0e5";
  const line = "#c9c3b4";

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);

  // 紙のような控えめな粒子と、図面を思わせる背景線
  ctx.fillStyle = "rgba(49, 60, 45, .055)";
  for (let y = 8; y < h; y += 19) {
    for (let x = 11; x < w; x += 23) {
      if ((x + y) % 5 < 2) ctx.fillRect(x, y, 1.3, 1.3);
    }
  }
  ctx.strokeStyle = "rgba(91, 112, 84, .18)";
  ctx.lineWidth = 1;
  for (let x = 705; x <= 1015; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 55); ctx.lineTo(x, 295); ctx.stroke();
  }
  for (let y = 71; y <= 295; y += 32) {
    ctx.beginPath(); ctx.moveTo(705, y); ctx.lineTo(1015, y); ctx.stroke();
  }

  // 抽象的な太陽と住宅のイラスト
  ctx.fillStyle = "#d9dfcf";
  ctx.beginPath(); ctx.arc(1012, 68, 118, Math.PI, Math.PI * 1.5); ctx.lineTo(1012, 68); ctx.fill();
  ctx.fillStyle = orange;
  ctx.beginPath(); ctx.arc(956, 255, 86, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#efe8d8";
  ctx.strokeStyle = "#5b5a48";
  ctx.lineWidth = 3;
  ctx.fillRect(742, 170, 252, 132);
  ctx.strokeRect(742, 170, 252, 132);
  ctx.beginPath();
  ctx.moveTo(715, 174); ctx.lineTo(862, 92); ctx.lineTo(1018, 174); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#49675c";
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const px = 793 + col * 47 + row * 13;
      const py = 113 + row * 30;
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px + 42, py - 2);
      ctx.lineTo(px + 53, py + 24); ctx.lineTo(px + 11, py + 27);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#d8e0d4"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  ctx.fillStyle = "#9cab8d"; ctx.fillRect(782, 222, 61, 80);
  ctx.fillStyle = ink; ctx.fillRect(900, 218, 57, 48);
  ctx.strokeStyle = paper; ctx.beginPath(); ctx.moveTo(928, 218); ctx.lineTo(928, 266); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(900, 242); ctx.lineTo(957, 242); ctx.stroke();

  ctx.fillStyle = ink;
  ctx.font = '700 28px "Hiragino Sans", sans-serif';
  ctx.fillText("ひだまりシミュレータ", 64, 66);
  ctx.fillStyle = orange;
  ctx.font = '700 18px "Avenir Next", sans-serif';
  ctx.fillText("SOLAR COST FORECAST / 30 YEARS", 64, 101);
  ctx.fillStyle = ink;
  ctx.font = '600 54px "Hiragino Mincho ProN", "Yu Mincho", serif';
  const shareTitle = $("hideSharePrefecture").checked
    ? "わが家の太陽光"
    : `${result.inputs.prefecture}の太陽光`;
  ctx.fillText(shareTitle, 64, 177);
  ctx.font = '600 62px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.fillText("何年で元が取れる？", 64, 247);
  ctx.strokeStyle = orange;
  ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.moveTo(66, 281); ctx.lineTo(637, 281); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = orange; ctx.beginPath(); ctx.arc(637, 281, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#56675f";
  ctx.font = '600 20px "Hiragino Sans", sans-serif';
  ctx.fillText(
    `パネル ${result.inputs.panelCapacity.toFixed(1)}kW  ｜  年間使用量 ${yen.format(result.inputs.usage)}kWh  ｜  自家消費率 ${yen.format(result.inputs.solarSelf * 100)}%`,
    66,
    317
  );

  roundedRect(ctx, 64, 350, 610, 205, 25);
  ctx.fillStyle = ink; ctx.fill();
  ctx.fillStyle = "#b7c8ac";
  ctx.font = '700 22px "Hiragino Sans", sans-serif';
  ctx.fillText("太陽光パネルのみ", 100, 394);
  ctx.fillStyle = "#fffdf7";
  ctx.font = '700 76px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.fillText(formatBreakEven(result.solarCrossing.final), 98, 482);
  ctx.font = '600 22px "Hiragino Sans", sans-serif';
  ctx.fillText("で元が取れる見込み", 100, 525);

  roundedRect(ctx, 698, 350, 318, 205, 25);
  ctx.fillStyle = "#eee8da"; ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#657265";
  ctx.font = '700 19px "Hiragino Sans", sans-serif';
  ctx.fillText(result.inputs.includeBattery ? "太陽光パネル＋蓄電池" : "30年後の節約額", 726, 393);
  ctx.fillStyle = ink;
  ctx.font = '700 42px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.fillText(
    result.inputs.includeBattery
      ? formatBreakEven(result.batteryCrossing.final)
      : `約${yen.format(saving / 10000)}万円`,
    725,
    462
  );
  ctx.font = '600 19px "Hiragino Sans", sans-serif';
  ctx.fillText(result.inputs.includeBattery ? "で元が取れる見込み" : "太陽光なしとの比較", 726, 510);

  roundedRect(ctx, 64, 584, 952, 142, 24);
  ctx.fillStyle = "#fffdf7"; ctx.fill();
  ctx.strokeStyle = line; ctx.stroke();
  ctx.fillStyle = "#657265";
  ctx.font = '700 21px "Hiragino Sans", sans-serif';
  ctx.fillText("30年後に減らせる金額", 98, 625);
  ctx.fillStyle = ink;
  ctx.font = '700 48px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.fillText(`約${yen.format(saving / 10000)}万円`, 98, 687);
  ctx.fillStyle = orange;
  ctx.fillRect(410, 659, 4, 27);
  ctx.font = '700 21px "Hiragino Sans", sans-serif';
  ctx.fillText("太陽光パネルのみ", 438, 683);
  if (result.inputs.includeBattery) {
    ctx.fillStyle = "#657265";
    ctx.font = '700 19px "Hiragino Sans", sans-serif';
    ctx.fillText(`蓄電池ありなら 約${yen.format(batterySaving / 10000)}万円`, 700, 683);
  }

  roundedRect(ctx, 64, 760, 952, 420, 27);
  ctx.fillStyle = "#fffdf7"; ctx.fill();
  ctx.strokeStyle = line; ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = '700 27px "Hiragino Sans", sans-serif';
  ctx.fillText("30年間に支払う合計金額の推移", 98, 810);
  ctx.fillStyle = "#718077";
  ctx.font = '500 17px "Hiragino Sans", sans-serif';
  ctx.fillText("設置費用・電気代・交換費用から、補助金と売電収入を差し引いた概算", 98, 842);

  const left = 112, top = 875, right = 965, bottom = 1083;
  const keys = result.inputs.includeBattery ? ["noSolar", "solar", "battery"] : ["noSolar", "solar"];
  const maxValue = Math.max(...result.data.flatMap((row) => keys.map((key) => row[key]))) * 1.05;
  ctx.strokeStyle = "#ded8ca";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) {
    const yy = bottom - ((bottom - top) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, yy);
    ctx.lineTo(right, yy);
    ctx.stroke();
  }
  const mapX = (year) => left + (year / YEARS) * (right - left);
  const mapY = (value) => bottom - (value / maxValue) * (bottom - top);
  [
    ["noSolar", COLORS.none],
    ["solar", COLORS.solar],
    ...(result.inputs.includeBattery ? [["battery", COLORS.battery]] : [])
  ].forEach(([key, color]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    result.data.forEach((row, index) => {
      if (index === 0) ctx.moveTo(mapX(row.year), mapY(row[key]));
      else ctx.lineTo(mapX(row.year), mapY(row[key]));
    });
    ctx.stroke();
  });

  ctx.fillStyle = "#687a75";
  ctx.font = '600 17px "Hiragino Sans", sans-serif';
  ctx.fillStyle = COLORS.none; ctx.fillRect(100, 1121, 28, 6);
  ctx.fillStyle = "#687a75"; ctx.fillText("太陽光なし", 140, 1130);
  ctx.fillStyle = COLORS.solar; ctx.fillRect(300, 1121, 28, 6);
  ctx.fillStyle = "#687a75"; ctx.fillText("太陽光パネルのみ", 340, 1130);
  if (result.inputs.includeBattery) {
    ctx.fillStyle = COLORS.battery; ctx.fillRect(600, 1121, 28, 6);
    ctx.fillStyle = "#687a75"; ctx.fillText("太陽光パネル＋蓄電池", 640, 1130);
  }

  ctx.fillStyle = ink;
  ctx.font = '700 25px "Hiragino Sans", sans-serif';
  ctx.fillText("ひだまりシミュレータ", 64, 1244);
  ctx.fillStyle = "#66756c";
  ctx.font = '500 17px "Hiragino Sans", sans-serif';
  ctx.fillText("※入力条件と地域の代表値に基づく概算です", 64, 1278);
  ctx.fillStyle = orange;
  ctx.font = '700 24px "Hiragino Sans", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText("#ななふしの家", 1016, 1247);
  ctx.textAlign = "left";
  ctx.strokeStyle = "#8d998c";
  ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.moveTo(64, 1305); ctx.lineTo(1016, 1305); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ink;
  ctx.font = '600 20px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.fillText("わが家の太陽光を、入る数字に。", 64, 1330);
}

function update() {
  applyPresetState();
  $("priceGrowthOutput").textContent = `${numberValue("priceGrowth").toFixed(1)}%`;
  $("selfConsumptionOutput").textContent = `${numberValue("selfConsumption")}%`;
  $("batteryConsumptionOutput").textContent = `${numberValue("batteryConsumption")}%`;
  const monthlyUsage = numberValue("annualUsage") / 12;
  const monthlyCost = monthlyUsage * numberValue("electricityPrice");
  $("monthlyCostEstimate").textContent =
    `月平均の電気代の目安：約${yen.format(monthlyCost)}円（使用量 約${yen.format(monthlyUsage)}kWh）`;
  const hasPrefecture = Boolean($("prefecture").value);
  $("resultsEmpty").hidden = hasPrefecture;
  $("shareHeader").disabled = !hasPrefecture;
  $("shareButton").disabled = !hasPrefecture;
  $("downloadImage").disabled = !hasPrefecture;
  $("resultsEmpty").closest(".results").classList.toggle("is-empty", !hasPrefecture);
  if (!hasPrefecture) {
    latest = null;
    $("regionNote").textContent = "";
    $("batteryFields").hidden = !$("includeBattery").checked;
    renderEmptyChart();
    return;
  }
  latest = calculate();
  $("batteryFields").hidden = !latest.inputs.includeBattery;
  renderSummary(latest);
  renderChart(latest);
  renderInsights(latest);
  renderTable(latest);
  drawShareImage(latest);
}

function openShareModal() {
  if (!latest) return;
  drawShareImage(latest);
  $("shareModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeShareModal() {
  $("shareModal").hidden = true;
  document.body.style.overflow = "";
}

function openHelpModal(button) {
  $("helpTitle").textContent = button.dataset.helpTitle;
  $("helpText").textContent = button.dataset.help;
  const source = $("helpSource");
  if (button.dataset.helpUrl) {
    source.href = button.dataset.helpUrl;
    source.textContent = button.dataset.helpLink || "参考資料を見る";
    source.hidden = false;
  } else {
    source.hidden = true;
    source.removeAttribute("href");
    source.textContent = "";
  }
  $("helpModal").hidden = false;
  document.body.style.overflow = "hidden";
  $("helpModal").querySelector("[data-close-help]").focus();
}

function closeHelpModal() {
  $("helpModal").hidden = true;
  document.body.style.overflow = "";
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
}

async function downloadShareImage() {
  drawShareImage(latest);
  const blob = await canvasBlob(shareCanvas);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "solar-cost-forecast.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function nativeShare() {
  drawShareImage(latest);
  const blob = await canvasBlob(shareCanvas);
  const file = new File([blob], "solar-cost-forecast.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText(latest), title: "太陽光コストシミュレーション" });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await downloadShareImage();
  await navigator.clipboard?.writeText(shareText(latest));
  alert("共有画像を保存し、投稿文をコピーしました。SNSで画像を添付してください。");
}

function openSocial(network) {
  const text = shareText(latest);
  const url =
    network === "x"
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
      : `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function handleChartMove(event) {
  if (!latest || !chartGeometry) return;
  const rect = chart.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const { padding, plotW } = chartGeometry;
  if (mx < padding.left || mx > padding.left + plotW) {
    $("chartTooltip").hidden = true;
    return;
  }
  const year = Math.max(0, Math.min(YEARS, Math.round(((mx - padding.left) / plotW) * YEARS)));
  const row = latest.data[year];
  const tooltip = $("chartTooltip");
  tooltip.innerHTML = `<strong>${year}年目</strong><br>
    太陽光なし：${formatMoney(row.noSolar)}<br>
    太陽光パネルのみ：${formatMoney(row.solar)}
    ${latest.inputs.includeBattery ? `<br>蓄電池あり：${formatMoney(row.battery)}` : ""}`;
  tooltip.hidden = false;
  const maxLeft = rect.width - 170;
  tooltip.style.left = `${Math.min(Math.max(mx + 12, 0), maxLeft)}px`;
  tooltip.style.top = `${Math.max(event.clientY - rect.top - 68, 5)}px`;
}

fillPrefectures();
$("daytimeLifestyle").addEventListener("change", (event) => {
  const value = Number(event.currentTarget.value);
  if (Number.isFinite(value)) $("selfConsumption").value = String(value);
});
$("selfConsumption").addEventListener("input", (event) => {
  const value = event.currentTarget.value;
  const matchingOption = [...$("daytimeLifestyle").options].some(
    (option) => option.value === value
  );
  $("daytimeLifestyle").value = matchingOption ? value : "custom";
});
form.addEventListener("input", update);
form.addEventListener("change", update);
window.addEventListener("resize", () => latest ? renderChart(latest) : renderEmptyChart());
$("resetButton").addEventListener("click", () => {
  form.reset();
  applyPresetState();
  update();
});
$("shareHeader").addEventListener("click", openShareModal);
$("shareButton").addEventListener("click", openShareModal);
$("downloadImage").addEventListener("click", downloadShareImage);
$("nativeShare").addEventListener("click", nativeShare);
$("shareX").addEventListener("click", () => openSocial("x"));
$("shareThreads").addEventListener("click", () => openSocial("threads"));
$("copyShareText").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(shareText(latest));
    button.textContent = "コピーしました";
    setTimeout(() => (button.textContent = original), 1600);
  } catch {
    button.textContent = "コピーできませんでした";
    setTimeout(() => (button.textContent = original), 1800);
  }
});
$("hideSharePrefecture").addEventListener("change", () => drawShareImage(latest));
document.querySelectorAll("[data-close-modal]").forEach((node) => node.addEventListener("click", closeShareModal));
document.querySelectorAll(".info-button").forEach((button) => {
  button.setAttribute("aria-label", `${button.dataset.helpTitle}の説明を開く`);
  button.addEventListener("click", () => openHelpModal(button));
});
document.querySelectorAll("[data-close-help]").forEach((node) => node.addEventListener("click", closeHelpModal));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!$("helpModal").hidden) closeHelpModal();
  else closeShareModal();
});
chart.addEventListener("pointermove", handleChartMove);
chart.addEventListener("pointerdown", handleChartMove);
chart.addEventListener("pointerleave", () => ($("chartTooltip").hidden = true));

update();
