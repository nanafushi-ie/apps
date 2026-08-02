"use client";

import { useEffect, useMemo, useState } from "react";

type Priority = "must" | "should";
type Mode = "solo" | "pair";
type Layer = "policy" | "layout" | "spec";
type Step = "welcome" | "basics" | "wishes" | "classify" | "rank" | "handoff" | "diff" | "document";
type Item = { id: string; category: string; label: string; description: string; rationale: string; type: "single" | "multi" };
type DiffView = Omit<Item,"type"> & { selectionType:Item["type"]; diffType:"match"|"gap"|"one"|"conflict"; as:boolean; bs:boolean };
type Help = { summary:string; effect:string; check:string };
type Answer = { selected: string[]; priorities: Record<string, Priority>; ranking: string[]; scores: Record<string,number>; notes: Partial<Record<Layer,string>> };
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
  { id:"window-double", category:"窓仕様", label:"複層ガラス", description:"2枚のガラスで窓の断熱性を高める", rationale:"窓からの熱の出入りと結露を抑えることを重視", type:"multi" },
  { id:"window-low-e", category:"窓仕様", label:"Low-E複層ガラス", description:"特殊金属膜で断熱・遮熱性能を高める", rationale:"季節に応じた断熱・遮熱性能を高めることを重視", type:"multi" },
  { id:"resin-sash", category:"窓仕様", label:"樹脂サッシ", description:"窓枠からの熱損失と結露を抑える", rationale:"サッシ部分の断熱性と結露対策を重視", type:"multi" },
  { id:"ih-cooking", category:"キッチン設備", label:"IHクッキングヒーター", description:"清掃性と火を使わない調理環境", rationale:"調理台の清掃性と火を使わない安心感を重視", type:"multi" },
  { id:"bath-dryer", category:"浴室設備", label:"浴室暖房乾燥機", description:"入浴前の暖房と浴室での衣類乾燥", rationale:"冬の入浴時の温度差対策と衣類乾燥を重視", type:"multi" },
  { id:"smart-lock", category:"玄関設備", label:"スマートキー・電気錠", description:"鍵を取り出さず施解錠する", rationale:"荷物を持った状態でも円滑に施解錠できることを重視", type:"multi" },
  { id:"high-eff-water", category:"給湯設備", label:"高効率給湯器", description:"エコキュートなどで給湯エネルギーを削減", rationale:"給湯にかかるエネルギーと光熱費を抑えることを重視", type:"multi" },
  { id:"maintenance-free-wall", category:"外装仕様", label:"高耐久・低メンテナンス外壁", description:"塗り替えや補修の頻度を抑える", rationale:"外壁の維持管理にかかる手間と費用を抑えることを重視", type:"multi" },
  { id:"tankless-toilet", category:"トイレ設備", label:"タンクレストイレ", description:"省スペースで清掃しやすい便器", rationale:"トイレ空間の清掃性とすっきりした見た目を重視", type:"multi" },
];

const LAYERS: { id:Layer; label:string; shortLabel:string; description:string }[] = [
  { id:"policy", label:"ライフスタイル・性能", shortLabel:"ライフスタイル・性能", description:"どんな暮らしをしたいか、住まいの基本性能をどう考えるか" },
  { id:"layout", label:"間取り", shortLabel:"間取り", description:"部屋の構成、広さ、配置、収納や家事動線" },
  { id:"spec", label:"設備・仕様", shortLabel:"設備・仕様", description:"間取りへの影響が比較的小さい機器、素材、仕上げ" },
];
const HELP:Record<string,Help> = {
  "living-stairs":{summary:"リビングの中に階段を設け、2階へ行くときにリビングを通る間取りです。",effect:"家族が顔を合わせやすい一方、音や冷暖房の空気が上下階へ伝わりやすくなります。",check:"階段入口の位置、空調計画、来客時の動線を確認します。"},
  "atrium":{summary:"上下の階の床を一部設けず、縦方向につながった大きな空間をつくることです。",effect:"明るさと開放感が得やすい一方、2階の床面積や空調効率との調整が必要です。",check:"窓の掃除方法、音の伝わり方、冷暖房計画を確認します。"},
  "high-ceiling":{summary:"屋根の傾きに合わせた天井や、一般的な天井より高い天井です。",effect:"床面積を増やさず開放感を出せますが、照明交換や空調に配慮が必要です。",check:"最も高い位置、照明の交換方法、シーリングファンの要否を確認します。"},
  "tatami":{summary:"床を一段高くした畳スペースです。段差部分を収納にする場合もあります。",effect:"腰掛けや昼寝に便利ですが、段差につまずく可能性があります。",check:"段差の高さ、収納の有無、将来の安全性を確認します。"},
  "walkthrough-closet":{summary:"入口と出口があり、通り抜けながら物を出し入れできる収納です。",effect:"動線を短くできますが、通路の分だけ収納できる壁面が減ります。",check:"通路幅と、収納量を優先するか移動の便利さを優先するかを確認します。"},
  "performance-high":{summary:"隙間を少なくし、壁・窓などから熱が逃げにくい家を優先する考え方です。",effect:"室温が安定しやすくなりますが、施工精度と適切な換気計画が重要です。",check:"断熱性能のUA値、気密性能のC値、測定の有無を施工会社へ確認します。"},
  "one-ac":{summary:"少ない台数のエアコンで、複数の部屋や家全体を冷暖房する計画です。",effect:"機器を減らせますが、断熱・気密・間取り・空気の経路を一体で設計する必要があります。",check:"設計者に温熱計算と、故障時の代替方法を確認します。"},
  "passive-solar":{summary:"冬の日差しを室内へ取り込み、夏は庇などで遮る設計手法です。",effect:"設備だけに頼らず快適性を高められますが、敷地の日当たりに左右されます。",check:"季節ご日射シミュレーションと、夏の西日対策を確認します。"},
  "ventilation":{summary:"給気口から外気を入れ、排気口から汚れた空気を出す経路を計画することです。",effect:"空気のよどみを防ぎます。フィルター清掃などの維持管理も必要です。",check:"給排気口の位置、フィルター交換費用、掃除のしやすさを確認します。"},
  "seismic":{summary:"建築基準法で求める耐震性より高い、住宅性能表示制度の最高等級です。",effect:"大地震への備えを高めますが、間取りの自由度や費用と調整する場合があります。",check:"許容応力度計算などの計算方法と、正式な評価書取得の有無を確認します。"},
  "all-electric":{summary:"コンロ・給湯・暖房などの主なエネルギーを電気に統一する住宅です。",effect:"ガス契約をなくせますが、停電時の備えや電気料金プランの検討が必要です。",check:"給湯器の種類、停電時に使える設備、契約容量を確認します。"},
  "solar":{summary:"屋根などのパネルで発電し、家庭で使ったり余った電気を売ったりする設備です。",effect:"購入電力を減らせますが、屋根条件・初期費用・将来の機器交換を考慮します。",check:"発電予測、保証、パワーコンディショナーの交換費用を確認します。"},
  "battery":{summary:"電気をためて、夜間や停電時に使える家庭用の蓄電設備です。",effect:"太陽光の自家消費や停電対策に役立ちますが、容量と交換費用の検討が必要です。",check:"停電時に使える回路、実際に使える容量、保証年数を確認します。"},
  "floor-heating":{summary:"床の下から部屋を暖める設備です。温水式と電気式があります。",effect:"足元が暖かく風が少ない一方、設置費用や修理方法を確認する必要があります。",check:"熱源、設置範囲、床材の制限、故障時の修理方法を確認します。"},
  "smart-home":{summary:"照明・空調・鍵などをスマートフォンや音声でまとめて操作する仕組みです。",effect:"自動化や遠隔操作ができますが、機器同士の互換性やサービス終了リスクがあります。",check:"対応規格、インターネット停止時の操作、手動操作の可否を確認します。"},
  "wired-lan":{summary:"Wi-Fiだけでなく、壁の中に通した通信ケーブルで各部屋を接続する設備です。",effect:"仕事や動画視聴の通信が安定しやすくなります。",check:"配線規格、情報分電盤の位置、将来ケーブルを交換できる配管を確認します。"},
  "dishwasher":{summary:"キッチンに組み込み、食器の洗浄から乾燥まで行う設備です。",effect:"家事時間を減らせますが、容量・扉の開き方・食器の入れ方が製品で異なります。",check:"家族人数に合う容量、フロントオープンか引き出しか、交換寸法を確認します。"},
  "drying-machine":{summary:"ガスの強い温風で衣類を短時間に乾かす機器です。",effect:"乾燥時間を短縮できますが、ガス配管と湿気を外へ出す工事が必要です。",check:"設置高さ、専用台、排湿管、衣類を出し入れする動線を確認します。"},
  "window-double":{summary:"2枚のガラスの間に空気層を設けた窓ガラスです。ペアガラスとも呼ばれます。",effect:"1枚ガラスより熱が伝わりにくく、結露を抑えやすくなります。",check:"ガラスだけでなく、窓枠（サッシ）の材質も合わせて確認します。"},
  "window-low-e":{summary:"複層ガラスの内側に薄い金属膜を付け、熱の出入りをさらに抑えたガラスです。",effect:"断熱型と遮熱型があり、窓の方角によって適した種類が異なります。",check:"方角ごとのガラス種、日射を取り込みたい窓と遮りたい窓を確認します。"},
  "resin-sash":{summary:"窓枠の主な部分を、熱を伝えにくい樹脂でつくったサッシです。",effect:"アルミ中心の窓枠より断熱性が高く、枠の結露を抑えやすくなります。",check:"ガラスとの組み合わせ、窓の大きさ、地域の気候に合う性能を確認します。"},
  "high-eff-water":{summary:"少ないエネルギーでお湯をつくる給湯器です。エコキュートなどが該当します。",effect:"光熱費を抑えやすい一方、機器やタンクの設置場所が必要です。",check:"家族に合う容量、運転音、設置場所、非常時に使える水量を確認します。"},
  "ih-cooking":{summary:"磁力で鍋自体を発熱させる、電気式の調理機器です。",effect:"天板が平らで掃除しやすい一方、使える鍋や同時使用時の出力に制限があります。",check:"手持ちの鍋への対応、最大火力、停電時の代替調理方法を確認します。"},
  "bath-dryer":{summary:"浴室の天井などに設置し、暖房・換気・衣類乾燥を行う設備です。",effect:"冬の入浴前暖房や雨天時の乾燥に使えますが、乾燥時間と電気・ガス代を確認します。",check:"熱源、物干し位置、フィルター掃除のしやすさを確認します。"},
  "smart-lock":{summary:"ボタン、カード、スマートフォンなどで玄関ドアを施解錠する電気式の鍵です。",effect:"鍵を取り出す手間が減りますが、電池切れや締め出しへの備えが必要です。",check:"非常用の物理鍵、電池交換通知、オートロック設定を確認します。"},
  "tankless-toilet":{summary:"便器の後ろに大きな貯水タンクがないトイレです。",effect:"空間がすっきりし掃除しやすい一方、別の手洗いや停電時の流し方を検討します。",check:"水圧条件、手洗い器の要否、停電・断水時の使用方法を確認します。"},
  "floor-solid":{summary:"一枚の天然木からつくった床材です。",effect:"足触りと経年変化が魅力ですが、傷・水分・乾燥による隙間や反りが生じることがあります。",check:"樹種、塗装、床暖房対応、日常の手入れ方法を確認します。"},
  "floor-veneer":{summary:"合板などの基材の表面に、比較的厚く切った天然木を貼った床材です。",effect:"天然木の質感を楽しみつつ、無垢床より寸法が安定しやすい床材です。",check:"表面材の厚さ、樹種、再研磨の可否、床暖房対応を確認します。"},
  "floor-composite":{summary:"合板などの基材に、薄い天然木や化粧シートを貼った一般的な床材です。",effect:"品質が安定し、傷や汚れに強い製品を選びやすいのが特徴です。",check:"表面が天然木かシートか、耐水・耐傷性能、補修方法を確認します。"},
  "floor-tile":{summary:"石や木の柄を印刷した、薄い塩化ビニル系の床材です。",effect:"水や傷に強く意匠を選びやすい一方、硬さや冷たさを感じる場合があります。",check:"使う部屋、床暖房対応、目地の見え方、下地の平滑さを確認します。"},
};
const SPEC_IDS = new Set(["dishwasher","all-electric","solar","delivery-box","drying-machine","floor-heating","battery","ev","smart-home","outlet-plan","wired-lan","stockpile","security-window","camera","outdoor-water","natural-material","easy-clean","neutral-design","accent-material","indirect-light","daylight-color","floor-solid","floor-veneer","floor-composite","floor-tile","window-double","window-low-e","resin-sash","ih-cooking","bath-dryer","smart-lock","high-eff-water","maintenance-free-wall","tankless-toilet"]);
const POLICY_CATEGORIES = new Set(["ライフスタイル","性能方針","将来・可変性"]);
const POLICY_IDS = new Set(["one-ac","passive-solar","ventilation","soundproof","seismic","flood"]);
const getLayer = (target:Item):Layer => SPEC_IDS.has(target.id) || target.category==="床材" ? "spec" : POLICY_CATEGORIES.has(target.category) || POLICY_IDS.has(target.id) ? "policy" : "layout";
const CATEGORY_STEPS = LAYERS.flatMap(layer => [...new Set(ITEMS.filter(i => getLayer(i)===layer.id).map(i => i.category))].map(category => ({ key:`${layer.id}:${category}`, layer:layer.id, category })));
const CATEGORIES = CATEGORY_STEPS.map(step => step.key);
const SPEC_ROOMS = ["家全体","玄関・外構","LDK・キッチン","洗面・ランドリー","浴室・トイレ","個室","内装・床材"];
const getSpecRoom = (target:Item) => {
  if(["delivery-box","camera","security-window","outdoor-water","smart-lock","maintenance-free-wall"].includes(target.id)) return "玄関・外構";
  if(["dishwasher","all-electric","ih-cooking"].includes(target.id)) return "LDK・キッチン";
  if(["drying-machine"].includes(target.id)) return "洗面・ランドリー";
  if(["bath-dryer","tankless-toilet"].includes(target.id)) return "浴室・トイレ";
  if(["floor-solid","floor-veneer","floor-composite","floor-tile","natural-material","easy-clean","neutral-design","accent-material","indirect-light","daylight-color"].includes(target.id)) return "内装・床材";
  return "家全体";
};
const EMPTY_ANSWER: Answer = { selected: [], priorities: {}, ranking: [], scores:{}, notes:{} };
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
  const [helpItemId,setHelpItemId] = useState<string|null>(null);
  const [sortState,setSortState] = useState<{sorted:string[]; pending:string[]; current:string; low:number; high:number; layerIndex:number; completed:string[]}|null>(null);
  const answer = state.answers[state.respondent];

  useEffect(() => { const saved=localStorage.getItem("ie-requirements-v1"); if(saved) try { const parsed=JSON.parse(saved); setState({...parsed,step:parsed.step==="classify"?"wishes":parsed.step}); } catch {} setReady(true); },[]);
  useEffect(() => { if(ready) localStorage.setItem("ie-requirements-v1",JSON.stringify(state)); },[state,ready]);
  useEffect(() => { if(ready) window.scrollTo(0,0); },[state.step,ready]);
  useEffect(() => {
    if(!helpItemId) return;
    const close=(event:KeyboardEvent)=>{ if(event.key==="Escape") setHelpItemId(null); };
    document.addEventListener("keydown",close); document.body.style.overflow="hidden";
    return ()=>{ document.removeEventListener("keydown",close); document.body.style.overflow=""; };
  },[helpItemId]);
  const patchAnswer = (next:Answer) => setState(s => ({...s,answers:s.answers.map((a,i)=>i===s.respondent?next:a)}));
  const progress = ({welcome:0,basics:12,wishes:32,classify:55,rank:75,handoff:78,diff:90,document:100}[state.step]);
  const canBasics = Object.values(state.basics).every(Boolean);
  const categoryIndex = CATEGORIES.indexOf(category);
  const isLastCategory = categoryIndex === CATEGORIES.length - 1;
  const categoryStep = CATEGORY_STEPS[categoryIndex] ?? CATEGORY_STEPS[0];
  const currentLayer = LAYERS.find(layer => layer.id===categoryStep.layer)!;
  const currentLayerSteps = CATEGORY_STEPS.map((step,index)=>({step,index})).filter(({step})=>step.layer===currentLayer.id);
  const currentLayerCategoryIndex = currentLayerSteps.findIndex(({step})=>step.key===category);
  const isLastInLayer = categoryIndex===CATEGORIES.length-1 || CATEGORY_STEPS[categoryIndex+1].layer!==categoryStep.layer;

  function toggle(id:string) {
    const target=item(id); let selected=[...answer.selected];
    if(selected.includes(id)) selected=selected.filter(x=>x!==id);
    else { if(target.type==="single") selected=selected.filter(x=>item(x).category!==target.category); selected.push(id); }
    const priorities={...answer.priorities}; selected.forEach(x=>priorities[x]??="should");
    const scores={...(answer.scores??{})}; selected.forEach(x=>scores[x]??=priorities[x]==="must"?5:3);
    patchAnswer({...answer,selected,priorities,scores,notes:answer.notes??{},ranking:[]});
  }
  function setPriority(id:string,priority:Priority) {
    patchAnswer({...answer,priorities:{...answer.priorities,[id]:priority},scores:{...(answer.scores??{}),[id]:priority==="must"?5:3},notes:answer.notes??{}});
  }
  function startRanking() {
    setState(s=>({...s,step:"rank"}));
    advanceLayerRanking(0,[]);
  }
  function advanceLayerRanking(layerIndex:number,completed:string[]) {
    if(layerIndex>=LAYERS.length){ patchAnswer({...answer,ranking:completed}); setSortState(null); finishRespondent(completed); return; }
    const ids=answer.selected.filter(id=>getLayer(item(id))===LAYERS[layerIndex].id);
    if(ids.length===0){ advanceLayerRanking(layerIndex+1,completed); return; }
    if(LAYERS[layerIndex].id!=="policy"){
      const ordered=[...ids].sort((a,b)=>((answer.scores??{})[b]??3)-((answer.scores??{})[a]??3));
      advanceLayerRanking(layerIndex+1,[...completed,...ordered]); return;
    }
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
    else if(as!==bs) type="one"; else if(as&&bs && (a.priorities[it.id]!==b.priorities[it.id] || (getLayer(it)==="policy"?Math.abs(a.ranking.indexOf(it.id)-b.ranking.indexOf(it.id))>3:Math.abs(fivePointScore(a,it.id)-fivePointScore(b,it.id))>=2))) type="gap";
    const {type:selectionType,...base}=it;
    return {...base,selectionType,diffType:type,as,bs} as DiffView;
  }).filter(d=>d.as||d.bs).sort((a,b)=>({conflict:0,gap:1,one:2,match:3}[a.diffType]-{conflict:0,gap:1,one:2,match:3}[b.diffType])),[state.answers]);

  if(!ready) return <main className="loading">要件を整理する準備をしています…</main>;
  return <main className="app">
    {state.step!=="welcome" && <header className="topbar no-print"><button className="brand" onClick={()=>setState(s=>({...s,step:"welcome"}))} aria-label="家づくりカルテのトップへ"><BrandMark /></button><div className="progress"><i style={{width:`${progress}%`}} /></div><button className="text-button" onClick={reset}>リセット</button></header>}

    {state.step==="welcome" && <section className="welcome">
      <button className="welcome-brand" onClick={()=>setState(s=>({...s,step:"welcome"}))} aria-label="家づくりカルテ"><BrandMark /></button>
      <div className="welcome-copy"><p className="hero-kicker">間取りを描く、その前に。</p><h1>迷わない家づくりは、<br/><em>希望の整理</em>から。</h1><p className="lead">質問にタップで答えるだけ。家族の「必ず」と「できれば」を整理して、設計士にそのまま渡せる一枚にまとめます。</p>
        <div className="mode-grid"><button aria-pressed={state.mode==="solo"} className={state.mode==="solo"?"mode active":"mode"} onClick={()=>setState(s=>({...s,mode:"solo"}))}><b>ひとりで整理</b><span className="mode-description">自分や家族の希望を1つにまとめる</span></button><button aria-pressed={state.mode==="pair"} className={state.mode==="pair"?"mode active":"mode"} onClick={()=>setState(s=>({...s,mode:"pair"}))}><b>ふたりで整理</b><span className="mode-description">別々に回答して、違いを見つける</span></button></div>
        <button className="primary large" onClick={()=>setState(s=>({...s,step:"basics"}))}>カルテをつくる <span>→</span></button><p className="save-note">登録不要・入力内容はこの端末に自動保存</p><p className="operator-credit">運営：<a href="https://note.com/nanafushi_ie" target="_blank" rel="noopener noreferrer">ななふしの家づくり <span aria-hidden="true">↗</span></a></p></div>
      <aside className="sample"><span className="paper-tag">完成イメージ</span><div className="paper"><small>HOME PLANNING BRIEF</small><h2>家づくりカルテ</h2><p className="paper-date">OUR HOME / 2026</p><hr/><h3>必ず実現したいこと</h3><ol><li><b>1</b><span>1階で生活を完結<br/><small>将来も無理なく暮らせる動線を重視</small></span></li><li><b>2</b><span>高気密高断熱<br/><small>年間を通じた室温の安定を重視</small></span></li><li><b>3</b><span>室内干しランドリー<br/><small>短い洗濯動線を重視</small></span></li></ol><div className="stamp">選ぶだけで<br/>完成</div></div></aside>
    </section>}

    {state.step==="basics" && <section className="screen narrow"><StepHead number="01" title="わが家の前提を教えてください" text="近いものをひとつずつ選びます。あとから変更できます。" />
      <div className="basic-list">{(Object.keys(BASIC_OPTIONS) as (keyof Basics)[]).map((key,idx)=>{const customBudget=key==="budget"&&!BASIC_OPTIONS.budget.includes(state.basics.budget)?state.basics.budget.replace(/万円$/,""):"";return <fieldset key={key}><legend><span>{String(idx+1).padStart(2,"0")}</span>{BASIC_LABELS[key]}</legend><div className="chips">{BASIC_OPTIONS[key].map(v=><button className={state.basics[key]===v?"chip selected":"chip"} onClick={()=>setState(s=>({...s,basics:{...s.basics,[key]:v}}))} key={v}>{v}</button>)}</div>{key==="budget"&&<div className="exact-budget"><label htmlFor="exact-budget">具体的な金額を入力する</label><div><input id="exact-budget" inputMode="numeric" autoComplete="off" value={customBudget} placeholder="例：3,800" onChange={e=>{const digits=e.target.value.replace(/[^0-9]/g,"");setState(s=>({...s,basics:{...s.basics,budget:digits?`${Number(digits).toLocaleString("ja-JP")}万円`:""}}));}}/><span>万円</span></div><small>選択肢ではなく、入力した金額が定義書に記載されます。</small></div>}</fieldset>})}</div>
      <Nav next={()=>setState(s=>({...s,step:"wishes"}))} disabled={!canBasics} />
    </section>}

    {state.step==="wishes" && <section className="screen"><StepHead number="02" title={`${state.mode==="pair"?`${state.respondent+1}人目の` : ""}希望を選んでください`} text="気になるものは、いったんすべて選んで大丈夫です。カテゴリを順番に確認します。" />
      <div className="stage-track" aria-label="希望整理の3つの区分">{LAYERS.map((stage,index)=><div key={stage.id} className={`stage-step ${stage.id===currentLayer.id?"active":"muted"}`} aria-current={stage.id===currentLayer.id?"step":undefined}><span>{String(index+1).padStart(2,"0")}</span><div><b>{stage.label}</b><small>{stage.description}</small></div></div>)}</div>
      <div className="category-position"><span>{categoryStep.category}</span><b>{currentLayerCategoryIndex + 1} / {currentLayerSteps.length}</b></div>
      <div className="category-tabs">{currentLayerSteps.map(({step,index})=><button key={step.key} disabled={index>categoryIndex} className={category===step.key?"active":""} onClick={()=>moveCategory(index)}>{step.category}<small>{answer.selected.filter(id=>item(id).category===step.category&&getLayer(item(id))===step.layer).length||""}</small></button>)}</div>
      <div className="wish-grid">{ITEMS.filter(i=>i.category===categoryStep.category&&getLayer(i)===categoryStep.layer).map(i=>{const selected=answer.selected.includes(i.id);return <div key={i.id} className={selected?"wish selected":"wish"}><button className="wish-select" onClick={()=>toggle(i.id)}><span className="check">{selected?"✓":"＋"}</span><b>{i.label}</b><small>{i.description}</small>{i.type==="single"&&<i>ひとつだけ選択</i>}</button>{HELP[i.id]&&<button className="info-button" aria-label={`${i.label}の説明を見る`} onClick={()=>setHelpItemId(i.id)}>i</button>}{selected&&<div className="wish-priority" aria-label={`${i.label}の希望度`}><button className={answer.priorities[i.id]!=="must"?"active":""} onClick={()=>setPriority(i.id,"should")}>できれば</button><button className={answer.priorities[i.id]==="must"?"must active":"must"} onClick={()=>setPriority(i.id,"must")}>必ず</button></div>}</div>})}</div>
      {isLastInLayer&&<div className="layer-note"><label htmlFor={`note-${currentLayer.id}`}>{currentLayer.label}について、選択肢にない希望</label><p>任意です。なければ空欄のまま進めます。</p><textarea id={`note-${currentLayer.id}`} value={(answer.notes??{})[currentLayer.id]??""} onChange={e=>patchAnswer({...answer,notes:{...(answer.notes??{}),[currentLayer.id]:e.target.value},scores:answer.scores??{}})} placeholder="例：休日は家族で料理を楽しめるようにしたい" rows={3}/></div>}
      <div className="selection-count"><b>{answer.selected.length}</b>件を選択中</div><Nav back={()=>categoryIndex===0?setState(s=>({...s,step:"basics"})):moveCategory(categoryIndex-1)} next={()=>isLastCategory?startRanking():moveCategory(categoryIndex+1)} disabled={isLastCategory&&answer.selected.length===0} label={isLastCategory?"優先順位へ進む":"次の項目へ進む"} />
    </section>}

    {state.step==="rank" && sortState?.current && <section className="compare-screen"><button className="secondary rank-back no-print" onClick={()=>{setSortState(null);setState(s=>({...s,step:"wishes"}));}}>← 要件選択へ戻る</button><div className="compare-top"><span>03</span><div><small>{LAYERS[sortState.layerIndex].label}</small><b>このグループの中で比較中</b></div></div><h2>どちらを、より優先しますか？</h2><p>ここでは「ライフスタイル・性能」の希望だけを比べます。どちらをより大切にしたいか選んでください。</p><div className="compare-grid"><CompareCard data={item(sortState.current)} priority={answer.priorities[sortState.current]} onClick={()=>compare(true)} /><div className="or">OR</div><CompareCard data={item(sortState.sorted[Math.floor((sortState.low+sortState.high)/2)])} priority={answer.priorities[sortState.sorted[Math.floor((sortState.low+sortState.high)/2)]]} onClick={()=>compare(false)} /></div></section>}

    {state.step==="handoff" && <section className="handoff"><div className="handoff-icon">↗</div><p className="eyebrow">1人目の回答を保存しました</p><h2>端末を2人目へ<br/>渡してください</h2><p>1人目の回答は表示しません。お互いの意見に引っ張られず、同じ質問へ回答できます。</p><button className="primary large" onClick={()=>{setState(s=>({...s,respondent:1,step:"wishes"}));setCategory(CATEGORIES[0]);}}>2人目の回答をはじめる →</button></section>}

    {state.step==="diff" && <section className="screen"><StepHead number="05" title="ふたりの違いが見つかりました" text="赤と黄色から話し合うと、大切な論点を見落としません。" />
      <div className="diff-summary">{[["conflict","直接対立"],["gap","温度差"],["one","片方のみ"],["match","一致"]].map(([k,l])=><div className={k} key={k}><b>{diffs.filter(d=>d.diffType===k).length}</b><span>{l}</span></div>)}</div>
      <div className="legend"><i className="conflict"/>直接対立 <i className="gap"/>温度差 <i className="one"/>片方のみ <i className="match"/>一致</div>
      <div className="diff-list">{diffs.map(d=><div className={`diff-row ${d.diffType}`} key={d.id}><div className="diff-title"><small>{d.category}</small><b>{d.label}</b></div><PersonAnswer label="1人目" answer={state.answers[0]} id={d.id}/><PersonAnswer label="2人目" answer={state.answers[1]} id={d.id}/><strong>{({conflict:"直接対立",gap:"温度差",one:"片方のみ",match:"一致"} as const)[d.diffType]}</strong></div>)}</div>
      <Nav next={()=>setState(s=>({...s,step:"document"}))} label="統合版を見る" />
    </section>}

    {state.step==="document" && <Document basics={state.basics} answer={state.mode==="solo"?state.answers[0]:mergeAnswers(state.answers)} mode={state.mode} diffs={diffs} onBack={()=>setState(s=>({...s,step:state.mode==="pair"?"diff":"wishes"}))} />}
    {helpItemId&&HELP[helpItemId]&&<HelpModal target={item(helpItemId)} help={HELP[helpItemId]} close={()=>setHelpItemId(null)}/>}
  </main>;
}

function StepHead({number,title,text}:{number:string,title:string,text:string}) { return <div className="step-head"><span>{number}</span><div><h1>{title}</h1><p>{text}</p></div></div> }
function BrandMark() { return <span className="brand-lockup"><span className="brand-icon" aria-hidden="true"><i>✓</i></span><span className="brand-words"><b>家づくりカルテ</b><small>HOME PLANNING BRIEF</small></span></span> }
function Nav({back,next,disabled,label="次へ進む"}:{back?:()=>void;next:()=>void;disabled?:boolean;label?:string}) { return <div className="nav no-print">{back?<button className="secondary" onClick={back}>← 戻る</button>:<span/>}<button className="primary" disabled={disabled} onClick={next}>{label} →</button></div> }
function CompareCard({data,priority,onClick}:{data:Item;priority:Priority;onClick:()=>void}) { return <button className="compare-card" onClick={onClick}><small>{data.category}</small><span className={priority}>{priority==="must"?"必ず":"できれば"}</span><b>{data.label}</b><p>{data.description}</p><i>こちらを優先 →</i></button> }
function HelpModal({target,help,close}:{target:Item;help:Help;close:()=>void}) { return <div className="help-overlay" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)close()}}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="help-close" onClick={close} aria-label="説明を閉じる">×</button><small>{target.category}｜用語の説明</small><h2 id="help-title">{target.label}</h2><p className="help-summary">{help.summary}</p><dl><div><dt>採用するとどうなる？</dt><dd>{help.effect}</dd></div><div><dt>何を確認すればいい？</dt><dd>{help.check}</dd></div></dl><button className="primary" onClick={close}>わかりました</button></section></div> }
function PersonAnswer({label,answer,id}:{label:string;answer:Answer;id:string}) { const selected=answer.selected.includes(id); const priority=answer.priorities[id]==="must"?"must":"should"; return <div className="person-answer"><small>{label}</small><b>{selected?(priority==="must"?"必ず":"できれば"):"選択なし"}</b>{selected&&(getLayer(item(id))==="policy"?<span className="mini-stars">{"★".repeat(fivePointScore(answer,id))}{"☆".repeat(5-fivePointScore(answer,id))}</span>:<span className={`mini-priority ${priority}`}>{priority==="must"?"必ず":"できれば"}</span>)}</div> }
function layerRanking(answer:Answer,layer:Layer) { const selected=answer.selected.filter(id=>getLayer(item(id))===layer); const ranked=answer.ranking.filter(id=>selected.includes(id)); return [...ranked,...selected.filter(id=>!ranked.includes(id))]; }
function fivePointScore(answer:Answer,id:string) {
  if(getLayer(item(id))!=="policy") return answer.priorities[id]==="must"?5:3;
  const priority=answer.priorities[id]??"should";
  const ranked=layerRanking(answer,"policy").filter(target=>answer.priorities[target]===priority); const index=ranked.indexOf(id);
  if(index<0) return 0;
  return priority==="must"?Math.max(4,5-Math.floor((index*2)/ranked.length)):Math.max(1,3-Math.floor((index*3)/ranked.length));
}
function mergeAnswers(answers:Answer[]):Answer {
  const selected=[...new Set(answers.flatMap(a=>a.selected))];
  const priorities=Object.fromEntries(selected.map(id=>[id,answers.some(a=>a.priorities[id]==="must")?"must":"should"])) as Record<string,Priority>;
  const ranking=LAYERS.flatMap(layer=>{
    const ids=selected.filter(id=>getLayer(item(id))===layer.id);
    const score=(id:string)=>answers.reduce((sum,a)=>sum+(a.selected.includes(id)?fivePointScore(a,id):0),0);
    return ids.sort((a,b)=>score(b)-score(a));
  });
  const scores=Object.fromEntries(selected.map(id=>[id,Math.round(answers.reduce((sum,a)=>sum+(a.selected.includes(id)?fivePointScore(a,id):0),0)/answers.filter(a=>a.selected.includes(id)).length)]));
  const notes=Object.fromEntries(LAYERS.map(layer=>[layer.id,answers.map((a,index)=>(a.notes??{})[layer.id]?.trim()?`${index+1}人目：${(a.notes??{})[layer.id]}`:"").filter(Boolean).join("\n")])) as Partial<Record<Layer,string>>;
  return {selected,priorities,ranking,scores,notes};
}
function Document({basics,answer,mode,diffs,onBack}:{basics:Basics;answer:Answer;mode:Mode;diffs:DiffView[];onBack:()=>void}) {
  return <section className="document-wrap"><div className="document-actions no-print"><button className="secondary" onClick={onBack}>← 内容を修正</button><button className="primary" onClick={()=>window.print()}>印刷・PDF保存</button></div><article className="document"><header><div><small>HOME PLANNING BRIEF</small><h1>家づくり<br/>カルテ</h1></div><div className="doc-mark">家づくり<br/><span>カルテ</span></div></header><p className="doc-intro">間取りを考える前に、わが家が大切にすることを優先順位とともに整理した資料です。</p>
    <section><h2><b className="section-tag">基本情報</b> プロジェクト概要</h2><div className="facts">{(Object.keys(basics) as (keyof Basics)[]).map(k=><div key={k}><small>{BASIC_LABELS[k]}</small><b>{basics[k]}</b></div>)}</div></section>
    <LayerRequirementSection number="ライフスタイル・性能" layer="policy" answer={answer} />
    <LayoutSection number="間取り" answer={answer} />
    <SpecSection number="設備・仕様" answer={answer} />
    {mode==="pair"&&<section className="appendix"><h2><b>A</b> ふたりの回答差分</h2><p>統合前の回答で、話し合いが必要だった項目です。</p>{diffs.filter(d=>d.diffType!=="match").map(d=><div key={d.id}><b>{d.label}</b><span>{({conflict:"直接対立",gap:"温度差",one:"片方のみ"} as Record<string,string>)[d.diffType]}</span></div>)}</section>}
    <footer><span>作成日 {new Intl.DateTimeFormat("ja-JP",{dateStyle:"long"}).format(new Date())}</span><span className="doc-credit">#ななふしの家づくり</span><span>家づくりカルテ</span></footer></article></section>
}
function LayerRequirementSection({number,layer,answer}:{number:string;layer:Layer;answer:Answer}) {
  const ranked=layerRanking(answer,layer); const definition=LAYERS.find(l=>l.id===layer)!;
  return <section><h2><b className="section-tag">{number}</b> 大切にすること</h2><p className="layer-description">{definition.description}</p>{(["must","should"] as Priority[]).map(priority=>{const ids=ranked.filter(id=>answer.priorities[id]===priority);return <div className="priority-block" key={priority}><h3>{priority==="must"?"必ず実現したい":"できれば実現したい"}</h3>{ids.length?<ol className="requirements">{ids.map(id=><li key={id}><StarRating score={fivePointScore(answer,id)}/><div><small>{item(id).category}</small><h3>{item(id).label}</h3><p>{item(id).description}</p></div></li>)}</ol>:<p className="empty">該当する項目はありません</p>}</div>})}<LayerNote layer={layer} answer={answer}/></section>
}
function LayoutSection({number,answer}:{number:string;answer:Answer}) {
  const ids=answer.selected.filter(id=>getLayer(item(id))==="layout"); const categories=[...new Set(ids.map(id=>item(id).category))];
  return <section><h2><b className="section-tag">{number}</b> カテゴリ別一覧</h2><p className="layer-description">部屋構成や動線に関する要件をカテゴリ別にまとめています。オレンジは「必ず」、緑は「できれば」を表します。</p><div className="spec-rooms">{categories.map(category=><div className="spec-room" key={category}><h3>{category}</h3>{ids.filter(id=>item(id).category===category).sort((a,b)=>fivePointScore(answer,b)-fivePointScore(answer,a)).map(id=><ScoreRow key={id} id={id} answer={answer}/>)}</div>)}</div>{!ids.length&&<p className="empty">該当する項目はありません</p>}<LayerNote layer="layout" answer={answer}/></section>
}
function SpecSection({number,answer}:{number:string;answer:Answer}) {
  const ids=layerRanking(answer,"spec");
  return <section><h2><b className="section-tag">{number}</b> 部屋別一覧</h2><p className="layer-description">間取りへの影響が比較的小さいオプションを、部屋別にまとめています。オレンジは「必ず」、緑は「できれば」を表します。</p><div className="spec-rooms">{SPEC_ROOMS.map(room=>{const roomIds=ids.filter(id=>getSpecRoom(item(id))===room);if(!roomIds.length)return null;return <div className="spec-room" key={room}><h3>{room}</h3>{roomIds.sort((a,b)=>fivePointScore(answer,b)-fivePointScore(answer,a)).map(id=><ScoreRow key={id} id={id} answer={answer}/>)}</div>})}</div>{!ids.length&&<p className="empty">該当する項目はありません</p>}<LayerNote layer="spec" answer={answer}/></section>
}
function ScoreRow({id,answer}:{id:string;answer:Answer}) { const priority=answer.priorities[id]==="must"?"must":"should"; return <div className={`spec-row ${priority}`}><div><small>{item(id).category}</small><b>{item(id).label}</b><p>{item(id).description}</p></div><span className={`priority-badge ${priority}`}>{priority==="must"?"必ず":"できれば"}</span></div> }
function StarRating({score}:{score:number}) { return <div className="stars" role="img" aria-label={`優先度5段階中${score}`}><span>{"★".repeat(score)}</span><i>{"★".repeat(5-score)}</i></div> }
function LayerNote({layer,answer}:{layer:Layer;answer:Answer}) { const note=(answer.notes??{})[layer]?.trim(); return note?<div className="document-note"><small>選択肢にない希望</small><p>{note}</p></div>:null }
