"use client";

import { useEffect, useMemo, useState } from "react";

type Priority = "must" | "should";
type Mode = "solo" | "pair";
type Layer = "policy" | "layout" | "spec";
type Step = "welcome" | "basics" | "wishes" | "classify" | "rank" | "handoff" | "diff" | "document";
type Item = { id: string; category: string; label: string; description: string; rationale: string; type: "single" | "multi" };
type Answer = { selected: string[]; priorities: Record<string, Priority>; ranking: string[] };
type Basics = { family: string; children: string; floor: string; budget: string; lot: string };

const ITEMS: Item[] = [
  { id:"living-stairs", category:"間取り・動線", label:"リビング階段", description:"家族が自然に顔を合わせる動線", rationale:"家族が日常的に顔を合わせられる動線を重視", type:"multi" },
  { id:"atrium", category:"間取り・動線", label:"吹き抜け", description:"上下階につながりと開放感をつくる", rationale:"上下階のつながりと開放感を重視", type:"multi" },
  { id:"guest-flow", category:"間取り・動線", label:"来客動線を分ける", description:"生活感を見せずに来客を迎える", rationale:"来客時にも家族のプライバシーを守れることを重視", type:"multi" },
  { id:"first-floor", category:"間取り・動線", label:"1階で生活を完結", description:"将来も階段に頼らず暮らせる", rationale:"将来も1階中心で無理なく暮らせることを重視", type:"multi" },
  { id:"kitchen-open", category:"キッチン", label:"対面キッチン", description:"家族を見渡しながら家事ができる", rationale:"家事をしながら家族の様子を見られることを重視", type:"single" },
  { id:"kitchen-semi", category:"キッチン", label:"セミオープンキッチン", description:"つながりと手元の隠しやすさを両立", rationale:"家族とのつながりと生活感の隠しやすさの両立を重視", type:"single" },
  { id:"kitchen-closed", category:"キッチン", label:"独立キッチン", description:"調理に集中し、匂いや音を分ける", rationale:"調理への集中と匂い・音の分離を重視", type:"single" },
  { id:"pantry", category:"キッチン設備", label:"パントリー", description:"食品や日用品をまとめてストック", rationale:"食品と日用品を一か所で管理できることを重視", type:"multi" },
  { id:"dishwasher", category:"キッチン設備", label:"大型食洗機", description:"毎日の食器洗いを省力化", rationale:"食器洗いの負担を減らし、家族の時間を確保することを重視", type:"multi" },
  { id:"kitchen-desk", category:"キッチン設備", label:"キッチン横ワークスペース", description:"家事の近くで仕事や勉強ができる", rationale:"家事と仕事・学習を近い場所で行えることを重視", type:"multi" },
  { id:"family-closet", category:"収納", label:"ファミリークローゼット", description:"家族の衣類を一か所に集約", rationale:"衣類収納と洗濯動線を集約することを重視", type:"multi" },
  { id:"entry-storage", category:"収納", label:"玄関土間収納", description:"靴や外用品を玄関で収める", rationale:"外で使う物を室内へ持ち込まず収納できることを重視", type:"multi" },
  { id:"linen", category:"収納", label:"リネン庫", description:"水回り用品を使う場所の近くへ", rationale:"水回り用品を使う場所の近くに収納できることを重視", type:"multi" },
  { id:"two-toilets", category:"水回り", label:"トイレを2か所", description:"朝の混雑や上下階移動を減らす", rationale:"朝の混雑と上下階の移動負担を減らすことを重視", type:"multi" },
  { id:"separate-wash", category:"水回り", label:"洗面と脱衣室を分ける", description:"入浴中でも洗面を使える", rationale:"家族が入浴中でも洗面を使えることを重視", type:"multi" },
  { id:"laundry", category:"水回り", label:"室内干しランドリー", description:"天候に左右されない洗濯動線", rationale:"天候に左右されず短い動線で洗濯できることを重視", type:"multi" },
  { id:"performance-high", category:"性能方針", label:"高気密高断熱を最優先", description:"初期費用より快適性と省エネを優先", rationale:"年間を通じた室温の安定と省エネ性を重視", type:"single" },
  { id:"performance-balance", category:"性能方針", label:"コストとのバランス", description:"性能と建築費の釣り合いを重視", rationale:"必要な性能と建築費のバランスを重視", type:"single" },
  { id:"all-electric", category:"設備・性能", label:"オール電化", description:"エネルギー源を電気に集約", rationale:"住宅設備のエネルギー源を電気に集約することを重視", type:"multi" },
  { id:"one-ac", category:"設備・性能", label:"少数エアコン運用", description:"少ない台数で家全体を快適に", rationale:"少ない空調設備で家全体を快適に保つことを重視", type:"multi" },
  { id:"solar", category:"設備・性能", label:"太陽光発電", description:"自家消費と光熱費削減を目指す", rationale:"エネルギーの自家消費と光熱費削減を重視", type:"multi" },
  { id:"delivery-box", category:"屋外・外構", label:"宅配ボックス", description:"不在時も荷物を受け取れる", rationale:"在宅状況にかかわらず荷物を受け取れることを重視", type:"multi" },
  { id:"bike", category:"屋外・外構", label:"屋根付き駐輪場", description:"自転車を雨風から守る", rationale:"日常的に使う自転車を雨風から守れることを重視", type:"multi" },
  { id:"balcony", category:"屋外・外構", label:"バルコニー", description:"屋外に物干しやくつろぎの場を確保", rationale:"屋外で洗濯物を干したりくつろげる場所を重視", type:"multi" },
  { id:"work-space", category:"ライフスタイル", label:"在宅ワークスペース", description:"生活空間の中に仕事の定位置をつくる", rationale:"在宅時に集中して仕事ができる定位置を重視", type:"multi" },
  { id:"study", category:"ライフスタイル", label:"独立した書斎", description:"音や視線を分けて集中できる", rationale:"生活音や視線から離れて集中できる空間を重視", type:"multi" },
  { id:"pet", category:"ライフスタイル", label:"ペット対応設備", description:"床・洗い場・居場所をペットに合わせる", rationale:"ペットと人が安全で快適に暮らせることを重視", type:"multi" },
  { id:"ldk-open", category:"LDK・居場所", label:"一体感のあるLDK", description:"食事・くつろぎ・家事を緩やかにつなぐ", rationale:"家族がそれぞれ過ごしながら気配を感じられることを重視", type:"multi" },
  { id:"living-zoned", category:"LDK・居場所", label:"リビングとダイニングを分ける", description:"食事とくつろぎの場を視覚的に分ける", rationale:"食事とくつろぎの場にそれぞれ落ち着きを持たせることを重視", type:"multi" },
  { id:"tatami", category:"LDK・居場所", label:"小上がり・畳コーナー", description:"昼寝や遊び、来客にも使える居場所", rationale:"多目的に使える床座の居場所を確保することを重視", type:"multi" },
  { id:"window-seat", category:"LDK・居場所", label:"窓辺のベンチ", description:"読書や庭を眺める小さな居場所", rationale:"窓辺で外を感じながら過ごせる居場所を重視", type:"multi" },
  { id:"high-ceiling", category:"LDK・居場所", label:"勾配天井・高天井", description:"床面積を増やさず開放感をつくる", rationale:"床面積以上の開放感を得られることを重視", type:"multi" },
  { id:"tv-less", category:"LDK・居場所", label:"テレビ中心にしないリビング", description:"会話や読書を中心に家具を配置", rationale:"テレビ以外の家族の過ごし方を中心にできることを重視", type:"multi" },
  { id:"dining-view", category:"LDK・居場所", label:"ダイニングから庭を眺める", description:"毎日の食事で外の景色を楽しむ", rationale:"食事の時間に庭や季節の変化を感じられることを重視", type:"multi" },
  { id:"bedroom-min", category:"個室・寝室", label:"寝室はコンパクトでよい", description:"寝る機能に絞り、面積を他へ配分", rationale:"寝室を必要最小限にして共用空間へ面積を配分することを重視", type:"multi" },
  { id:"bedroom-hotel", category:"個室・寝室", label:"ホテルライクな主寝室", description:"照明・収納・素材まで落ち着きを優先", rationale:"一日の終わりに落ち着いて休める寝室の質を重視", type:"multi" },
  { id:"kids-flex", category:"個室・寝室", label:"将来分けられる子ども部屋", description:"幼少期は広く、成長後は個室にする", rationale:"子どもの成長に合わせて部屋の使い方を変えられることを重視", type:"multi" },
  { id:"kids-small", category:"個室・寝室", label:"子ども部屋は最小限", description:"個室より家族の共用空間を優先", rationale:"子どもが共用空間で過ごす時間を増やすことを重視", type:"multi" },
  { id:"guest-room", category:"個室・寝室", label:"独立した客間", description:"宿泊客のプライバシーを確保", rationale:"宿泊する来客が落ち着いて過ごせることを重視", type:"multi" },
  { id:"multi-room", category:"個室・寝室", label:"用途を限定しない予備室", description:"仕事・介護・趣味など変化に対応", rationale:"家族構成や働き方の変化に対応できる余白を重視", type:"multi" },
  { id:"walkthrough-closet", category:"収納", label:"通り抜けできる収納", description:"収納を動線の一部にして回遊する", rationale:"移動しながら片付けられる収納動線を重視", type:"multi" },
  { id:"living-storage", category:"収納", label:"リビング収納", description:"書類・薬・文具などを共用部に集約", rationale:"家族共用の細かな物をリビングで管理できることを重視", type:"multi" },
  { id:"vacuum-base", category:"収納", label:"掃除機・ロボット基地", description:"充電や手入れまで隠して収める", rationale:"掃除道具を使いやすく目立たない場所に収めることを重視", type:"multi" },
  { id:"seasonal-storage", category:"収納", label:"季節物の大型収納", description:"布団・雛人形・家電などをまとめる", rationale:"使用時期が限られる大型品を無理なく保管できることを重視", type:"multi" },
  { id:"book-wall", category:"収納", label:"壁一面の本棚", description:"本を見渡せる形で暮らしの中心へ", rationale:"本を身近に置き、家族が手に取りやすいことを重視", type:"multi" },
  { id:"hidden-storage", category:"収納", label:"見せない収納を中心にする", description:"扉付き収納で生活感を抑える", rationale:"物が視界に入りにくい落ち着いた室内を重視", type:"multi" },
  { id:"open-storage", category:"収納", label:"見せる収納を楽しむ", description:"道具や本をディスプレイとして活用", rationale:"お気に入りの物を見せながら使いやすく収納することを重視", type:"multi" },
  { id:"laundry-loop", category:"家事動線", label:"洗濯の回遊動線", description:"洗う・干す・畳む・しまうを近接", rationale:"洗濯の一連の作業を短い動線で完結することを重視", type:"multi" },
  { id:"kitchen-entry", category:"家事動線", label:"玄関からキッチンへ直行", description:"買い物袋を短い動線で運ぶ", rationale:"買い物後の荷物を短い動線で収納できることを重視", type:"multi" },
  { id:"circular-flow", category:"家事動線", label:"行き止まりのない回遊動線", description:"家族同士がぶつかりにくく移動できる", rationale:"家の中を複数の経路で移動できることを重視", type:"multi" },
  { id:"morning-flow", category:"家事動線", label:"朝の支度動線を集約", description:"洗面・着替え・持ち物を近づける", rationale:"家族の朝の支度を混雑なく短時間で行えることを重視", type:"multi" },
  { id:"mudroom-flow", category:"家事動線", label:"帰宅後すぐ手洗い・着替え", description:"玄関から汚れを居室へ持ち込まない", rationale:"帰宅後の衛生行動を自然に行える動線を重視", type:"multi" },
  { id:"double-bowl", category:"水回り", label:"洗面ボウルを2つ", description:"家族が同時に身支度できる", rationale:"忙しい時間帯に複数人が同時に身支度できることを重視", type:"multi" },
  { id:"wash-outside", category:"水回り", label:"廊下・玄関近くの洗面", description:"来客も脱衣室へ入らず使える", rationale:"来客も生活感のある場所へ入らず手洗いできることを重視", type:"multi" },
  { id:"bath-window", category:"水回り", label:"浴室に窓", description:"自然光や外の景色を取り込む", rationale:"浴室に自然光と外への抜けを取り入れることを重視", type:"multi" },
  { id:"bath-no-window", category:"水回り", label:"浴室は窓なしでよい", description:"断熱・掃除・防犯を優先", rationale:"浴室の断熱性と掃除のしやすさ、防犯性を重視", type:"multi" },
  { id:"drying-machine", category:"水回り", label:"ガス衣類乾燥機", description:"短時間で洗濯物を乾かす", rationale:"天候を問わず短時間で洗濯物を乾かせることを重視", type:"multi" },
  { id:"deep-bath", category:"水回り", label:"広い浴室・浴槽", description:"入浴時間の快適さを優先", rationale:"家族がゆったり入浴できる広さを重視", type:"multi" },
  { id:"toilet-sink", category:"水回り", label:"トイレ内の独立手洗い", description:"来客も洗面室を通らず使える", rationale:"トイレ内で手洗いまで完結できることを重視", type:"multi" },
  { id:"passive-solar", category:"設備・性能", label:"日射取得・遮蔽を活かす", description:"冬の日差しを取り込み夏は遮る", rationale:"自然エネルギーを活かして室温を整えることを重視", type:"multi" },
  { id:"ventilation", category:"設備・性能", label:"換気計画を重視", description:"空気の入口と出口、メンテ性まで考える", rationale:"室内の空気質と換気設備の維持管理性を重視", type:"multi" },
  { id:"soundproof", category:"設備・性能", label:"室内の防音・遮音", description:"生活音や仕事・趣味の音を分ける", rationale:"家族がお互いの音を気にせず過ごせることを重視", type:"multi" },
  { id:"floor-heating", category:"設備・性能", label:"床暖房", description:"足元から穏やかに暖める", rationale:"冬の足元の快適性を重視", type:"multi" },
  { id:"battery", category:"設備・性能", label:"家庭用蓄電池", description:"太陽光の自家消費と停電対策", rationale:"発電した電気の活用と停電時の備えを重視", type:"multi" },
  { id:"ev", category:"設備・性能", label:"EV充電設備", description:"将来の電気自動車にも備える", rationale:"電気自動車を自宅で充電できることを重視", type:"multi" },
  { id:"smart-home", category:"設備・性能", label:"スマートホーム対応", description:"照明・空調・鍵を連携して操作", rationale:"住宅設備をまとめて便利に操作できることを重視", type:"multi" },
  { id:"outlet-plan", category:"設備・性能", label:"コンセント計画を重視", description:"家具・家電・充電位置から逆算", rationale:"延長コードに頼らず家電を使える配置を重視", type:"multi" },
  { id:"wired-lan", category:"設備・性能", label:"有線LAN・通信盤", description:"仕事・動画・ゲームの通信を安定化", rationale:"家中で安定した通信環境を確保することを重視", type:"multi" },
  { id:"seismic", category:"防災・防犯", label:"耐震等級3", description:"大きな地震への構造的な備え", rationale:"大地震時の倒壊リスクを抑えることを重視", type:"multi" },
  { id:"flood", category:"防災・防犯", label:"水害を考慮した計画", description:"地盤高・設備位置・避難を検討", rationale:"浸水時の被害と生活への影響を抑えることを重視", type:"multi" },
  { id:"stockpile", category:"防災・防犯", label:"防災備蓄収納", description:"水・食料・非常用品の定位置", rationale:"災害時の備蓄を無理なく保管・更新できることを重視", type:"multi" },
  { id:"security-window", category:"防災・防犯", label:"窓の防犯性", description:"侵入されにくいサイズ・ガラス・鍵", rationale:"窓からの侵入リスクを抑えることを重視", type:"multi" },
  { id:"camera", category:"防災・防犯", label:"防犯カメラ・録画インターホン", description:"敷地周辺の状況を確認・記録", rationale:"不在時も敷地周辺の状況を確認できることを重視", type:"multi" },
  { id:"privacy", category:"窓・採光", label:"外からの視線を遮る", description:"カーテンを閉め切らず暮らせる窓計画", rationale:"外からの視線を気にせず室内で過ごせることを重視", type:"multi" },
  { id:"morning-sun", category:"窓・採光", label:"朝日が入るダイニング", description:"朝の生活時間に自然光を取り込む", rationale:"朝の時間を自然光の中で過ごせることを重視", type:"multi" },
  { id:"south-light", category:"窓・採光", label:"南面の大開口", description:"明るさと庭へのつながりを優先", rationale:"豊かな自然光と庭への連続性を重視", type:"multi" },
  { id:"high-window", category:"窓・採光", label:"高窓・地窓を活用", description:"視線を避けながら光と風を入れる", rationale:"プライバシーを守りながら採光・通風を確保することを重視", type:"multi" },
  { id:"few-windows", category:"窓・採光", label:"窓を必要最小限にする", description:"断熱・耐震・家具配置を優先", rationale:"断熱性、耐震性、家具配置のしやすさを重視", type:"multi" },
  { id:"deck", category:"屋外・外構", label:"ウッドデッキ・テラス", description:"室内から連続する屋外の居場所", rationale:"室内と庭をつなぐ屋外の居場所を重視", type:"multi" },
  { id:"garden", category:"屋外・外構", label:"家庭菜園・植栽スペース", description:"育てる楽しみと季節感を取り入れる", rationale:"植物を育て、季節の変化を感じられることを重視", type:"multi" },
  { id:"low-maintenance-yard", category:"屋外・外構", label:"手入れの少ない外構", description:"草取りや塗り替えの負担を抑える", rationale:"外構の維持管理にかかる時間と費用を抑えることを重視", type:"multi" },
  { id:"two-cars", category:"屋外・外構", label:"駐車2台以上", description:"来客や将来の車保有にも備える", rationale:"複数台の車を無理なく駐車できることを重視", type:"multi" },
  { id:"carport", category:"屋外・外構", label:"カーポート", description:"雨天時の乗降や車の日射対策", rationale:"雨天時の乗降と車を雨・日射から守ることを重視", type:"multi" },
  { id:"outdoor-water", category:"屋外・外構", label:"使いやすい外水栓", description:"洗車・庭・ペットの手入れに使う", rationale:"屋外の掃除や手入れをしやすくすることを重視", type:"multi" },
  { id:"barrier-free", category:"将来・可変性", label:"段差の少ないバリアフリー", description:"高齢期や怪我のときも移動しやすい", rationale:"身体状況が変わっても安全に移動できることを重視", type:"multi" },
  { id:"wheelchair", category:"将来・可変性", label:"車椅子に対応できる幅", description:"廊下・扉・トイレに余裕を持たせる", rationale:"将来の車椅子利用にも対応できる寸法を重視", type:"multi" },
  { id:"future-bedroom", category:"将来・可変性", label:"1階に将来の寝室候補", description:"今は別用途、将来は寝室に転用", rationale:"階段を使いにくくなった際も1階で暮らせることを重視", type:"multi" },
  { id:"partition-flex", category:"将来・可変性", label:"間仕切りを変更しやすくする", description:"家族構成に合わせて部屋を再編", rationale:"将来の家族構成に合わせて空間を変更できることを重視", type:"multi" },
  { id:"maintenance", category:"将来・可変性", label:"点検・交換のしやすさ", description:"設備配管へアクセスしやすくする", rationale:"将来の点検や設備交換を無理なく行えることを重視", type:"multi" },
  { id:"resale", category:"将来・可変性", label:"売却・賃貸しやすい汎用性", description:"特殊すぎない間取りと立地適応", rationale:"将来の売却や賃貸にも対応しやすい汎用性を重視", type:"multi" },
  { id:"natural-material", category:"素材・デザイン", label:"無垢材・自然素材", description:"手触りや経年変化を楽しむ", rationale:"自然素材の質感と経年変化を楽しめることを重視", type:"multi" },
  { id:"easy-clean", category:"素材・デザイン", label:"掃除しやすい素材", description:"汚れにくさと手入れの簡単さを優先", rationale:"日常の掃除と手入れにかかる負担を抑えることを重視", type:"multi" },
  { id:"neutral-design", category:"素材・デザイン", label:"飽きにくいシンプルな内装", description:"家具や暮らしの変化になじむ", rationale:"長く暮らしても飽きにくく家具を合わせやすいことを重視", type:"multi" },
  { id:"accent-material", category:"素材・デザイン", label:"素材感のあるアクセント", description:"タイル・木・左官などを印象的に使う", rationale:"素材の表情を楽しめる印象的な場所をつくることを重視", type:"multi" },
  { id:"indirect-light", category:"素材・デザイン", label:"間接照明を活用", description:"夜の落ち着きと陰影をつくる", rationale:"夜間にまぶしさを抑えた落ち着く光環境を重視", type:"multi" },
  { id:"daylight-color", category:"素材・デザイン", label:"昼と夜で照明を使い分ける", description:"作業性とくつろぎを両立", rationale:"時間帯と行動に合った明るさ・光色を選べることを重視", type:"multi" },
  { id:"floor-solid", category:"床材", label:"無垢床", description:"天然木の足触りと経年変化を楽しむ", rationale:"天然木ならではの足触りと経年変化を重視", type:"single" },
  { id:"floor-veneer", category:"床材", label:"挽板フローリング", description:"木の質感と寸法安定性を両立", rationale:"天然木の質感と扱いやすさの両立を重視", type:"single" },
  { id:"floor-composite", category:"床材", label:"複合フローリング", description:"手入れのしやすさと費用を重視", rationale:"手入れのしやすさと導入費用のバランスを重視", type:"single" },
  { id:"floor-tile", category:"床材", label:"フロアタイル", description:"耐水性・耐久性と意匠性を重視", rationale:"水や傷への強さと意匠性を重視", type:"single" },
];

const LAYERS: { id:Layer; label:string; shortLabel:string; description:string }[] = [
  { id:"policy", label:"ライフスタイル・性能方針", shortLabel:"方針", description:"どんな暮らしをしたいか、住まいの基本性能をどう考えるか" },
  { id:"layout", label:"間取り", shortLabel:"間取り", description:"部屋の構成、広さ、配置、収納や家事動線" },
  { id:"spec", label:"仕様や設備", shortLabel:"仕様・設備", description:"間取りへの影響が比較的小さい機器、素材、仕上げ" },
];
const SPEC_IDS = new Set(["dishwasher","all-electric","solar","delivery-box","drying-machine","floor-heating","battery","ev","smart-home","outlet-plan","wired-lan","stockpile","security-window","camera","outdoor-water","natural-material","easy-clean","neutral-design","accent-material","indirect-light","daylight-color","floor-solid","floor-veneer","floor-composite","floor-tile"]);
const POLICY_CATEGORIES = new Set(["ライフスタイル","性能方針","将来・可変性"]);
const POLICY_IDS = new Set(["one-ac","passive-solar","ventilation","soundproof","seismic","flood"]);
const getLayer = (target:Item):Layer => SPEC_IDS.has(target.id) || target.category==="床材" ? "spec" : POLICY_CATEGORIES.has(target.category) || POLICY_IDS.has(target.id) ? "policy" : "layout";
const CATEGORY_STEPS = LAYERS.flatMap(layer => [...new Set(ITEMS.filter(i => getLayer(i)===layer.id).map(i => i.category))].map(category => ({ key:`${layer.id}:${category}`, layer:layer.id, category })));
const CATEGORIES = CATEGORY_STEPS.map(step => step.key);
const SPEC_ROOMS = ["家全体","玄関・外構","LDK・キッチン","洗面・ランドリー","浴室・トイレ","個室","内装・床材"];
const getSpecRoom = (target:Item) => {
  if(["delivery-box","camera","security-window","outdoor-water"].includes(target.id)) return "玄関・外構";
  if(["dishwasher","all-electric"].includes(target.id)) return "LDK・キッチン";
  if(["drying-machine"].includes(target.id)) return "洗面・ランドリー";
  if(["floor-solid","floor-veneer","floor-composite","floor-tile","natural-material","easy-clean","neutral-design","accent-material","indirect-light","daylight-color"].includes(target.id)) return "内装・床材";
  return "家全体";
};
const EMPTY_ANSWER: Answer = { selected: [], priorities: {}, ranking: [] };
const EMPTY_BASICS: Basics = { family:"", children:"", floor:"", budget:"", lot:"" };
const BASIC_OPTIONS = {
  family:["1人","2人","3人","4人","5人以上"], children:["子どもなし","未就学児","小学生","中高生","成人した子"],
  floor:["〜30坪","30〜35坪","35〜40坪","40坪〜","まだ未定"], budget:["〜2,500万円","2,500〜3,500万円","3,500〜4,500万円","4,500万円〜","まだ未定"],
  lot:["整形地","変形地","旗竿地","土地探し中","まだ未定"]
};
const BASIC_LABELS: Record<keyof Basics,string> = { family:"家族の人数", children:"子どもの年齢帯", floor:"延床面積の目安", budget:"建物予算", lot:"敷地条件" };

const item = (id:string) => ITEMS.find(i => i.id === id)!;
const initialState = () => ({ step:"welcome" as Step, mode:"solo" as Mode, basics:EMPTY_BASICS, respondent:0, answers:[EMPTY_ANSWER, EMPTY_ANSWER] as Answer[] });

export default function Home() {
  const [ready,setReady] = useState(false);
  const [state,setState] = useState(initialState);
  const [category,setCategory] = useState(CATEGORIES[0]);
  const [sortState,setSortState] = useState<{sorted:string[]; pending:string[]; current:string; low:number; high:number; layerIndex:number; completed:string[]}|null>(null);
  const answer = state.answers[state.respondent];

  useEffect(() => { const saved=localStorage.getItem("ie-requirements-v1"); if(saved) try { setState(JSON.parse(saved)); } catch {} setReady(true); },[]);
  useEffect(() => { if(ready) localStorage.setItem("ie-requirements-v1",JSON.stringify(state)); },[state,ready]);
  const patchAnswer = (next:Answer) => setState(s => ({...s,answers:s.answers.map((a,i)=>i===s.respondent?next:a)}));
  const progress = ({welcome:0,basics:12,wishes:32,classify:55,rank:75,handoff:78,diff:90,document:100}[state.step]);
  const canBasics = Object.values(state.basics).every(Boolean);
  const categoryIndex = CATEGORIES.indexOf(category);
  const isLastCategory = categoryIndex === CATEGORIES.length - 1;
  const categoryStep = CATEGORY_STEPS[categoryIndex] ?? CATEGORY_STEPS[0];
  const currentLayer = LAYERS.find(layer => layer.id===categoryStep.layer)!;

  function toggle(id:string) {
    const target=item(id); let selected=[...answer.selected];
    if(selected.includes(id)) selected=selected.filter(x=>x!==id);
    else { if(target.type==="single") selected=selected.filter(x=>item(x).category!==target.category); selected.push(id); }
    const priorities={...answer.priorities}; selected.forEach(x=>priorities[x]??="should");
    patchAnswer({...answer,selected,priorities,ranking:[]});
  }
  function startRanking() {
    setState(s=>({...s,step:"rank"}));
    advanceLayerRanking(0,[]);
  }
  function advanceLayerRanking(layerIndex:number,completed:string[]) {
    if(layerIndex>=LAYERS.length){ patchAnswer({...answer,ranking:completed}); setSortState(null); finishRespondent(completed); return; }
    const ids=answer.selected.filter(id=>getLayer(item(id))===LAYERS[layerIndex].id);
    if(ids.length===0){ advanceLayerRanking(layerIndex+1,completed); return; }
    if(ids.length===1){ advanceLayerRanking(layerIndex+1,[...completed,ids[0]]); return; }
    setSortState({sorted:[ids[0]],pending:ids.slice(2),current:ids[1],low:0,high:1,layerIndex,completed});
  }
  function compare(preferCurrent:boolean) {
    if(!sortState?.current) return;
    let {sorted,pending,current,low,high}=sortState;
    const mid=Math.floor((low+high)/2);
    if(preferCurrent) high=mid; else low=mid+1;
    if(low<high){ setSortState({...sortState,low,high}); return; }
    sorted=[...sorted.slice(0,low),current,...sorted.slice(low)];
    if(!pending.length){ advanceLayerRanking(sortState.layerIndex+1,[...sortState.completed,...sorted]); return; }
    current=pending[0]; pending=pending.slice(1); setSortState({...sortState,sorted,pending,current,low:0,high:sorted.length});
  }
  function finishRespondent(ranking=answer.ranking) {
    const answers=state.answers.map((a,i)=>i===state.respondent?{...a,ranking}:a);
    if(state.mode==="pair" && state.respondent===0) setState(s=>({...s,answers,step:"handoff"}));
    else setState(s=>({...s,answers,step:state.mode==="pair"?"diff":"document"}));
  }
  function reset() { if(confirm("入力内容をすべて消して、最初から始めますか？")){ localStorage.removeItem("ie-requirements-v1"); setState(initialState()); setCategory(CATEGORIES[0]); } }
  function moveCategory(nextIndex:number) {
    setCategory(CATEGORIES[nextIndex]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const diffs=useMemo(()=>ITEMS.map(it=>{
    const a=state.answers[0],b=state.answers[1],as=a.selected.includes(it.id),bs=b.selected.includes(it.id);
    let type:"match"|"gap"|"one"|"conflict"="match";
    if(it.type==="single") { const ac=a.selected.find(x=>item(x).category===it.category),bc=b.selected.find(x=>item(x).category===it.category); if(ac&&bc&&ac!==bc) type="conflict"; else if(as!==bs) type="one"; }
    else if(as!==bs) type="one"; else if(as&&bs && (a.priorities[it.id]!==b.priorities[it.id] || Math.abs(a.ranking.indexOf(it.id)-b.ranking.indexOf(it.id))>3)) type="gap";
    return {...it,type,as,bs};
  }).filter(d=>d.as||d.bs).sort((a,b)=>({conflict:0,gap:1,one:2,match:3}[a.type]-{conflict:0,gap:1,one:2,match:3}[b.type])),[state.answers]);

  if(!ready) return <main className="loading">要件を整理する準備をしています…</main>;
  return <main className="app">
    {state.step!=="welcome" && <header className="topbar no-print"><button className="brand" onClick={()=>setState(s=>({...s,step:"welcome"}))}>IE <span>requirements</span></button><div className="progress"><i style={{width:`${progress}%`}} /></div><button className="text-button" onClick={reset}>リセット</button></header>}

    {state.step==="welcome" && <section className="welcome">
      <div className="welcome-copy"><p className="eyebrow">間取りを描く、その前に。</p><h1>わが家の<br/><em>大事なこと</em>を決める。</h1><p className="lead">質問にタップで答えるだけ。家族の希望と優先順位を整理して、設計士に渡せる「家づくり要件定義書」をつくります。</p>
        <div className="mode-grid"><button className={state.mode==="solo"?"mode active":"mode"} onClick={()=>setState(s=>({...s,mode:"solo"}))}><b>ひとりで整理</b><span>自分や家族の希望を1つにまとめる</span></button><button className={state.mode==="pair"?"mode active":"mode"} onClick={()=>setState(s=>({...s,mode:"pair"}))}><b>ふたりで整理</b><span>別々に回答して、違いを見つける</span></button></div>
        <button className="primary large" onClick={()=>setState(s=>({...s,step:"basics"}))}>要件整理をはじめる <span>→</span></button><p className="save-note">入力内容はこの端末に自動保存されます</p></div>
      <aside className="sample"><span className="paper-tag">完成イメージ</span><div className="paper"><small>HOUSE REQUIREMENTS</small><h2>家づくり要件定義書</h2><p className="paper-date">OUR HOME / 2026</p><hr/><h3>絶対に叶えたいこと</h3><ol><li><b>1</b><span>1階で生活を完結<br/><small>将来も無理なく暮らせる動線を重視</small></span></li><li><b>2</b><span>高気密高断熱<br/><small>年間を通じた室温の安定を重視</small></span></li><li><b>3</b><span>室内干しランドリー<br/><small>短い洗濯動線を重視</small></span></li></ol><div className="stamp">選択だけで<br/>完成</div></div></aside>
    </section>}

    {state.step==="basics" && <section className="screen narrow"><StepHead number="01" title="わが家の前提を教えてください" text="近いものをひとつずつ選びます。あとから変更できます。" />
      <div className="basic-list">{(Object.keys(BASIC_OPTIONS) as (keyof Basics)[]).map((key,idx)=><fieldset key={key}><legend><span>{String(idx+1).padStart(2,"0")}</span>{BASIC_LABELS[key]}</legend><div className="chips">{BASIC_OPTIONS[key].map(v=><button className={state.basics[key]===v?"chip selected":"chip"} onClick={()=>setState(s=>({...s,basics:{...s.basics,[key]:v}}))} key={v}>{v}</button>)}</div></fieldset>)}</div>
      <Nav next={()=>setState(s=>({...s,step:"wishes"}))} disabled={!canBasics} />
    </section>}

    {state.step==="wishes" && <section className="screen"><StepHead number="02" title={`${state.mode==="pair"?`${state.respondent+1}人目の` : ""}希望を選んでください`} text="気になるものは、いったんすべて選んで大丈夫です。カテゴリを順番に確認します。" />
      <div className={`layer-banner ${currentLayer.id}`}><small>レイヤー {LAYERS.findIndex(l=>l.id===currentLayer.id)+1}</small><b>{currentLayer.label}</b><span>{currentLayer.description}</span></div>
      <div className="category-position"><span>{categoryStep.category}</span><b>{categoryIndex + 1} / {CATEGORIES.length}</b></div>
      <div className="category-tabs">{CATEGORY_STEPS.map((step,index)=><button key={step.key} disabled={index>categoryIndex} className={category===step.key?"active":""} onClick={()=>moveCategory(index)}>{step.category}<small>{answer.selected.filter(id=>item(id).category===step.category&&getLayer(item(id))===step.layer).length||""}</small></button>)}</div>
      <div className="wish-grid">{ITEMS.filter(i=>i.category===categoryStep.category&&getLayer(i)===categoryStep.layer).map(i=><button key={i.id} className={answer.selected.includes(i.id)?"wish selected":"wish"} onClick={()=>toggle(i.id)}><span className="check">{answer.selected.includes(i.id)?"✓":"＋"}</span><b>{i.label}</b><small>{i.description}</small>{i.type==="single"&&<i>ひとつだけ選択</i>}</button>)}</div>
      <div className="selection-count"><b>{answer.selected.length}</b>件を選択中</div><Nav back={()=>categoryIndex===0?setState(s=>({...s,step:"basics"})):moveCategory(categoryIndex-1)} next={()=>isLastCategory?setState(s=>({...s,step:"classify"})):moveCategory(categoryIndex+1)} disabled={isLastCategory&&answer.selected.length===0} label={isLastCategory?"仕分けへ進む":"次の項目へ進む"} />
    </section>}

    {state.step==="classify" && <section className="screen narrow"><StepHead number="03" title="絶対条件を決めましょう" text="初期値は「できれば」です。譲れないものだけをMustに変えます。" />
      <div className="classify-list">{LAYERS.flatMap(layer=>answer.selected.filter(id=>getLayer(item(id))===layer.id).map(id=><div className="classify-row" key={id}><div><small>{layer.label} ｜ {item(id).category}</small><b>{item(id).label}</b></div><div className="segmented"><button className={answer.priorities[id]!=="must"?"active":""} onClick={()=>patchAnswer({...answer,priorities:{...answer.priorities,[id]:"should"}})}>できれば</button><button className={answer.priorities[id]==="must"?"must active":"must"} onClick={()=>patchAnswer({...answer,priorities:{...answer.priorities,[id]:"must"}})}>絶対条件</button></div></div>))}</div>
      <Nav back={()=>setState(s=>({...s,step:"wishes"}))} next={startRanking} label="優先順位を決める" />
    </section>}

    {state.step==="rank" && sortState?.current && <section className="compare-screen"><div className="compare-top"><span>04</span><div><small>レイヤー {sortState.layerIndex+1}｜{LAYERS[sortState.layerIndex].label}</small><b>このレイヤー内で比較中</b></div></div><h2>どちらを、より優先しますか？</h2><p>異なるレイヤーとは比べません。同じレイヤーの中で、どちらを残したいか選んでください。</p><div className="compare-grid"><CompareCard data={item(sortState.current)} priority={answer.priorities[sortState.current]} onClick={()=>compare(true)} /><div className="or">OR</div><CompareCard data={item(sortState.sorted[Math.floor((sortState.low+sortState.high)/2)])} priority={answer.priorities[sortState.sorted[Math.floor((sortState.low+sortState.high)/2)]]} onClick={()=>compare(false)} /></div></section>}

    {state.step==="handoff" && <section className="handoff"><div className="handoff-icon">↗</div><p className="eyebrow">1人目の回答を保存しました</p><h2>端末を2人目へ<br/>渡してください</h2><p>1人目の回答は表示しません。お互いの意見に引っ張られず、同じ質問へ回答できます。</p><button className="primary large" onClick={()=>{setState(s=>({...s,respondent:1,step:"wishes"}));setCategory(CATEGORIES[0]);}}>2人目の回答をはじめる →</button></section>}

    {state.step==="diff" && <section className="screen"><StepHead number="05" title="ふたりの違いが見つかりました" text="赤と黄色から話し合うと、大切な論点を見落としません。" />
      <div className="diff-summary">{[["conflict","直接対立"],["gap","温度差"],["one","片方のみ"],["match","一致"]].map(([k,l])=><div className={k} key={k}><b>{diffs.filter(d=>d.type===k).length}</b><span>{l}</span></div>)}</div>
      <div className="legend"><i className="conflict"/>直接対立 <i className="gap"/>温度差 <i className="one"/>片方のみ <i className="match"/>一致</div>
      <div className="diff-list">{diffs.map(d=><div className={`diff-row ${d.type}`} key={d.id}><div className="diff-title"><small>{d.category}</small><b>{d.label}</b></div><PersonAnswer label="1人目" answer={state.answers[0]} id={d.id}/><PersonAnswer label="2人目" answer={state.answers[1]} id={d.id}/><strong>{({conflict:"直接対立",gap:"温度差",one:"片方のみ",match:"一致"} as const)[d.type]}</strong></div>)}</div>
      <Nav next={()=>setState(s=>({...s,step:"document"}))} label="統合版を見る" />
    </section>}

    {state.step==="document" && <Document basics={state.basics} answer={state.mode==="solo"?state.answers[0]:mergeAnswers(state.answers)} mode={state.mode} diffs={diffs} onBack={()=>setState(s=>({...s,step:state.mode==="pair"?"diff":"classify"}))} />}
  </main>;
}

function StepHead({number,title,text}:{number:string,title:string,text:string}) { return <div className="step-head"><span>{number}</span><div><h1>{title}</h1><p>{text}</p></div></div> }
function Nav({back,next,disabled,label="次へ進む"}:{back?:()=>void;next:()=>void;disabled?:boolean;label?:string}) { return <div className="nav no-print">{back?<button className="secondary" onClick={back}>← 戻る</button>:<span/>}<button className="primary" disabled={disabled} onClick={next}>{label} →</button></div> }
function CompareCard({data,priority,onClick}:{data:Item;priority:Priority;onClick:()=>void}) { return <button className="compare-card" onClick={onClick}><small>{data.category}</small><span className={priority}>{priority==="must"?"絶対条件":"できれば"}</span><b>{data.label}</b><p>{data.description}</p><i>こちらを優先 →</i></button> }
function PersonAnswer({label,answer,id}:{label:string;answer:Answer;id:string}) { const selected=answer.selected.includes(id); const rank=answer.ranking.indexOf(id); return <div className="person-answer"><small>{label}</small><b>{selected?(answer.priorities[id]==="must"?"絶対条件":"できれば"):"選択なし"}</b>{selected&&rank>=0&&<span>優先度 {rank+1}位</span>}</div> }
function layerRanking(answer:Answer,layer:Layer) { const selected=answer.selected.filter(id=>getLayer(item(id))===layer); const ranked=answer.ranking.filter(id=>selected.includes(id)); return [...ranked,...selected.filter(id=>!ranked.includes(id))]; }
function priorityScore(answer:Answer,id:string) { const ranked=layerRanking(answer,getLayer(item(id))); const index=ranked.indexOf(id); return index<0?0:Math.round(((ranked.length-index)/ranked.length)*100); }
function mergeAnswers(answers:Answer[]):Answer {
  const selected=[...new Set(answers.flatMap(a=>a.selected))];
  const priorities=Object.fromEntries(selected.map(id=>[id,answers.some(a=>a.priorities[id]==="must")?"must":"should"]));
  const ranking=LAYERS.flatMap(layer=>{
    const ids=selected.filter(id=>getLayer(item(id))===layer.id);
    const score=(id:string)=>answers.reduce((sum,a)=>sum+(a.selected.includes(id)?priorityScore(a,id):0),0);
    return ids.sort((a,b)=>score(b)-score(a));
  });
  return {selected,priorities,ranking} as Answer;
}
function Document({basics,answer,mode,diffs,onBack}:{basics:Basics;answer:Answer;mode:Mode;diffs:(Item&{type:string;as:boolean;bs:boolean})[];onBack:()=>void}) {
  return <section className="document-wrap"><div className="document-actions no-print"><button className="secondary" onClick={onBack}>← 内容を修正</button><button className="primary" onClick={()=>window.print()}>印刷・PDF保存</button></div><article className="document"><header><div><small>HOUSE REQUIREMENTS / 01</small><h1>家づくり<br/>要件定義書</h1></div><div className="doc-mark">IE<br/><span>requirements</span></div></header><p className="doc-intro">間取りを考える前に、わが家が大切にすることを優先順位とともに整理した資料です。</p>
    <section><h2><b>01</b> プロジェクト概要</h2><div className="facts">{(Object.keys(basics) as (keyof Basics)[]).map(k=><div key={k}><small>{BASIC_LABELS[k]}</small><b>{basics[k]}</b></div>)}</div></section>
    <LayerRequirementSection number="02" layer="policy" answer={answer} />
    <LayerRequirementSection number="03" layer="layout" answer={answer} />
    <SpecSection number="04" answer={answer} />
    <section><h2><b>05</b> 設計・見積もり時の使い方</h2><div className="guidance"><p><b>01</b>上位の暮らし方・性能方針から確認する</p><p><b>02</b>その方針を満たす間取りを検討する</p><p><b>03</b>仕様設備は部屋別のスコアを見て予算調整する</p></div></section>
    {mode==="pair"&&<section className="appendix"><h2><b>A</b> ふたりの回答差分</h2><p>統合前の回答で、話し合いが必要だった項目です。</p>{diffs.filter(d=>d.type!=="match").map(d=><div key={d.id}><b>{d.label}</b><span>{({conflict:"直接対立",gap:"温度差",one:"片方のみ"} as Record<string,string>)[d.type]}</span></div>)}</section>}
    <footer>作成日 {new Intl.DateTimeFormat("ja-JP",{dateStyle:"long"}).format(new Date())}<span>IE REQUIREMENTS</span></footer></article></section>
}
function LayerRequirementSection({number,layer,answer}:{number:string;layer:Layer;answer:Answer}) {
  const ranked=layerRanking(answer,layer); const definition=LAYERS.find(l=>l.id===layer)!;
  return <section><h2><b>{number}</b> {definition.label}</h2><p className="layer-description">{definition.description}</p>{(["must","should"] as Priority[]).map(priority=>{const ids=ranked.filter(id=>answer.priorities[id]===priority);return <div className="priority-block" key={priority}><h3>{priority==="must"?"Must｜絶対条件":"Should｜できれば"}</h3>{ids.length?<ol className="requirements">{ids.map((id,idx)=><li key={id}><strong>{String(idx+1).padStart(2,"0")}</strong><div><small>{item(id).category}</small><h3>{item(id).label}</h3><p>{item(id).rationale}。</p></div></li>)}</ol>:<p className="empty">該当する項目はありません</p>}</div>})}</section>
}
function SpecSection({number,answer}:{number:string;answer:Answer}) {
  const ids=layerRanking(answer,"spec");
  return <section><h2><b>{number}</b> 仕様や設備｜部屋別一覧</h2><p className="layer-description">間取りへの影響が比較的小さいオプションを、部屋別にまとめています。スコアは仕様・設備レイヤー内での相対的な優先度です。</p><div className="spec-rooms">{SPEC_ROOMS.map(room=>{const roomIds=ids.filter(id=>getSpecRoom(item(id))===room);if(!roomIds.length)return null;return <div className="spec-room" key={room}><h3>{room}</h3>{roomIds.map(id=><div className="spec-row" key={id}><div><small>{answer.priorities[id]==="must"?"Must":"Should"}｜{item(id).category}</small><b>{item(id).label}</b></div><div className="score"><strong>{priorityScore(answer,id)}</strong><span>/ 100</span></div></div>)}</div>})}</div>{!ids.length&&<p className="empty">該当する項目はありません</p>}</section>
}
