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
  $("prefecture").innerHTML = PREFECTURES.map(
    ([name, yieldValue]) =>
      `<option value="${name}" data-yield="${yieldValue}" ${name === "宮城県" ? "selected" : ""}>${name}</option>`
  ).join("");
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
  if ($("solarPreset").checked) setPresetValues(SOLAR_PRESET);
  if ($("batteryPreset").checked) setPresetValues(BATTERY_PRESET);
  setSectionLocked("solarSettings", $("solarPreset").checked, ["solarPreset"]);
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
      label: "太陽光のみ",
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
    ["太陽光のみ", COLORS.solar],
    ...(result.inputs.includeBattery ? [["蓄電池あり", COLORS.battery]] : [])
  ]
    .map(([label, color]) => `<span><i style="background:${color}"></i>${label}</span>`)
    .join("");
}

function renderInsights(result) {
  const inputs = result.inputs;
  const last = result.data[result.data.length - 1];
  const solarSaving = last.noSolar - last.solar;
  if (result.solarCrossing.final == null) {
    $("breakEvenHeadline").textContent = "太陽光のみは30年以内には元が取れない見込みです";
    $("breakEvenText").textContent = `30年後に支払う合計金額の差は${formatMoney(Math.abs(solarSaving))}です。最初にかかる費用や発電量を見直してみてください。`;
  } else {
    $("breakEvenHeadline").textContent = `太陽光のみは約${result.solarCrossing.final.toFixed(1)}年で元が取れる見込みです`;
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
  return `${result.inputs.prefecture}・太陽光${result.inputs.panelCapacity.toFixed(1)}kWでシミュレーションしました。\n\n太陽光のみで元が取れるまで：${formatBreakEven(result.solarCrossing.final)}\n30年後に減らせる金額：約${yen.format(Math.max(saving, 0) / 10000)}万円\n\n太陽光発電の導入効果をシミュレーションできます。\n${TOP_PAGE_URL}\n\n#ななふしの家 #太陽光発電 #住宅`;
}

function drawShareImage(result) {
  const ctx = shareCtx;
  const w = shareCanvas.width;
  const h = shareCanvas.height;
  const last = result.data[result.data.length - 1];
  const saving = Math.max(last.noSolar - last.solar, 0);
  const batterySaving = Math.max(last.noSolar - last.battery, 0);

  ctx.fillStyle = "#f7f4e9";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#f5b83d";
  ctx.beginPath();
  ctx.arc(1040, 45, 170, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#18312b";
  ctx.font = '700 30px "Hiragino Sans", sans-serif';
  ctx.fillText("ひだまりシミュレータ", 70, 72);
  ctx.fillStyle = "#d88e0c";
  ctx.font = '700 21px "Avenir Next", sans-serif';
  ctx.fillText("SOLAR COST FORECAST", 70, 113);
  ctx.fillStyle = "#18312b";
  ctx.font = '600 54px "Hiragino Mincho ProN", serif';
  ctx.fillText(`${result.inputs.prefecture}の太陽光`, 70, 184);
  ctx.fillText("シミュレーション結果", 70, 248);
  ctx.fillStyle = "#687a75";
  ctx.font = '600 24px "Hiragino Sans", sans-serif';
  ctx.fillText(
    `パネル ${result.inputs.panelCapacity.toFixed(1)}kW　年間使用量 ${yen.format(result.inputs.usage)}kWh`,
    70,
    292
  );

  roundedRect(ctx, 70, 330, 450, 210, 26);
  ctx.fillStyle = "#164f42";
  ctx.fill();
  ctx.fillStyle = "#8bc8b7";
  ctx.font = '700 24px "Hiragino Sans", sans-serif';
  ctx.fillText("太陽光のみ", 104, 377);
  ctx.fillStyle = "#fff";
  ctx.font = '700 49px "Hiragino Sans", sans-serif';
  ctx.fillText(formatBreakEven(result.solarCrossing.final), 104, 449);
  ctx.font = '600 23px "Hiragino Sans", sans-serif';
  ctx.fillText("で元が取れる見込み", 104, 499);

  roundedRect(ctx, 560, 330, 450, 210, 26);
  ctx.fillStyle = result.inputs.includeBattery ? "#e2f0eb" : "#fff";
  ctx.fill();
  ctx.strokeStyle = result.inputs.includeBattery ? "#9fc8ba" : "#dcded6";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = result.inputs.includeBattery ? "#24745f" : "#687a75";
  ctx.font = '700 24px "Hiragino Sans", sans-serif';
  ctx.fillText(result.inputs.includeBattery ? "太陽光＋蓄電池" : "30年後の節約額", 594, 377);
  ctx.fillStyle = "#18312b";
  ctx.font = '700 49px "Hiragino Sans", sans-serif';
  ctx.fillText(
    result.inputs.includeBattery
      ? formatBreakEven(result.batteryCrossing.final)
      : `約${yen.format(saving / 10000)}万円`,
    594,
    449
  );
  ctx.font = '600 23px "Hiragino Sans", sans-serif';
  ctx.fillText(
    result.inputs.includeBattery ? "で元が取れる見込み" : "太陽光なしとの比較",
    594,
    499
  );

  roundedRect(ctx, 70, 575, 940, 150, 24);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#dcded6";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#687a75";
  ctx.font = '700 25px "Hiragino Sans", sans-serif';
  ctx.fillText("30年後に減らせる金額", 105, 625);
  ctx.fillStyle = "#18312b";
  ctx.font = '700 50px "Hiragino Sans", sans-serif';
  ctx.fillText(`太陽光のみ 約${yen.format(saving / 10000)}万円`, 105, 689);
  if (result.inputs.includeBattery) {
    ctx.fillStyle = "#24745f";
    ctx.font = '700 27px "Hiragino Sans", sans-serif';
    ctx.fillText(`蓄電池あり 約${yen.format(batterySaving / 10000)}万円`, 650, 681);
  }

  roundedRect(ctx, 70, 760, 940, 430, 28);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#dcded6";
  ctx.stroke();
  ctx.fillStyle = "#18312b";
  ctx.font = '700 28px "Hiragino Sans", sans-serif';
  ctx.fillText("30年間で支払う合計金額", 105, 812);

  const left = 120, top = 855, right = 960, bottom = 1095;
  const keys = result.inputs.includeBattery ? ["noSolar", "solar", "battery"] : ["noSolar", "solar"];
  const maxValue = Math.max(...result.data.flatMap((row) => keys.map((key) => row[key]))) * 1.05;
  ctx.strokeStyle = "#dcded6";
  ctx.lineWidth = 2;
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
    ctx.lineWidth = 7;
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
  ctx.font = '600 21px "Hiragino Sans", sans-serif';
  ctx.fillText("太陽光なし", 115, 1148);
  ctx.fillStyle = COLORS.none; ctx.fillRect(245, 1136, 38, 7);
  ctx.fillStyle = "#687a75"; ctx.fillText("太陽光のみ", 345, 1148);
  ctx.fillStyle = COLORS.solar; ctx.fillRect(475, 1136, 38, 7);
  if (result.inputs.includeBattery) {
    ctx.fillStyle = "#687a75"; ctx.fillText("蓄電池あり", 575, 1148);
    ctx.fillStyle = COLORS.battery; ctx.fillRect(705, 1136, 38, 7);
  }

  ctx.fillStyle = "#687a75";
  ctx.font = '500 20px "Hiragino Sans", sans-serif';
  ctx.fillText("※入力条件と地域の代表値に基づく概算です", 70, 1260);
  ctx.fillStyle = "#24745f";
  ctx.font = '700 25px "Hiragino Sans", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText("#ななふしの家", 1010, 1260);
  ctx.textAlign = "left";
  ctx.fillStyle = "#18312b";
  ctx.font = '700 24px "Hiragino Sans", sans-serif';
  ctx.fillText("ひだまりシミュレータで試してみる", 70, 1312);
}

function update() {
  applyPresetState();
  latest = calculate();
  $("priceGrowthOutput").textContent = `${numberValue("priceGrowth").toFixed(1)}%`;
  $("selfConsumptionOutput").textContent = `${numberValue("selfConsumption")}%`;
  $("batteryConsumptionOutput").textContent = `${numberValue("batteryConsumption")}%`;
  const monthlyUsage = latest.inputs.usage / 12;
  const monthlyCost = monthlyUsage * latest.inputs.electricityPrice;
  $("monthlyCostEstimate").textContent =
    `月平均の目安：約${yen.format(monthlyUsage)}kWh／約${yen.format(monthlyCost)}円`;
  $("batteryFields").hidden = !latest.inputs.includeBattery;
  renderSummary(latest);
  renderChart(latest);
  renderInsights(latest);
  renderTable(latest);
  drawShareImage(latest);
}

function openShareModal() {
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
    太陽光のみ：${formatMoney(row.solar)}
    ${latest.inputs.includeBattery ? `<br>蓄電池あり：${formatMoney(row.battery)}` : ""}`;
  tooltip.hidden = false;
  const maxLeft = rect.width - 170;
  tooltip.style.left = `${Math.min(Math.max(mx + 12, 0), maxLeft)}px`;
  tooltip.style.top = `${Math.max(event.clientY - rect.top - 68, 5)}px`;
}

fillPrefectures();
form.addEventListener("input", update);
form.addEventListener("change", update);
window.addEventListener("resize", () => latest && renderChart(latest));
$("resetButton").addEventListener("click", () => {
  form.reset();
  $("prefecture").value = "宮城県";
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
