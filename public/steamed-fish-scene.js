export const steamedFish = {
  stages: ['洗净', '姜葱', '清蒸', '上桌'],
  cues: ['鲈鱼洗净，整鱼装盘。', '铺上姜葱，准备入锅。', '盖好锅盖，蒸至鱼肉熟透。', '按口味调味，去刺后分餐。'],
  ends: [1400, 2800, 5200, 6800],
  mins: [3, 1, 8, 3],
  artwork: `<svg class="cooking-stove fish-scene" viewBox="0 0 540 280" aria-hidden="true">
    <ellipse cx="270" cy="253" rx="202" ry="13" fill="#d8c4aa" opacity=".3" stroke="none"/>
    <rect x="54" y="240" width="432" height="9" rx="4" fill="#dfc29d" stroke="#b99a75"/>
    <g class="fish-board"><rect x="98" y="199" width="344" height="24" rx="12" fill="#cca474" stroke="#a47b52"/><path d="M119 207H419M129 215H399" stroke="#e6c59d"/></g>
    <g class="fish-pot-back"><rect x="190" y="226" width="160" height="14" rx="6" fill="#577b85"/><path d="M127 177H105Q91 194 118 196M413 177H435Q449 194 422 196" fill="none" stroke="#708c92" stroke-width="8"/><rect x="128" y="163" width="284" height="64" rx="21" fill="#9eb7b9" stroke="#64858d"/><ellipse cx="270" cy="164" rx="142" ry="27" fill="#e6efeb" stroke="#64858d"/></g>
    <g class="fish-platter">
      <ellipse cx="270" cy="182" rx="159" ry="34" fill="#b9ccca" stroke="none"/>
      <ellipse cx="270" cy="174" rx="159" ry="37" fill="#fffdf0" stroke="#82a7af" stroke-width="3"/>
      <ellipse cx="270" cy="172" rx="139" ry="27" fill="#eaf2ed" stroke="#bed3cd"/>
      <ellipse class="fish-sauce" cx="270" cy="174" rx="123" ry="24" fill="#bd884e" stroke="none"/>
      <g class="fish-whole" stroke="#708e91" stroke-width="2">
        <path d="M228 132L245 113L262 127L279 114L294 134" fill="#80a4aa"/>
        <path d="M326 147L379 126L368 153L384 181L325 167Z" fill="#8cabb0"/>
        <path d="M346 149L371 137M347 157L371 171" fill="none"/>
        <path d="M153 153C181 119 272 115 332 145Q348 153 331 168C267 197 184 185 153 153Z" fill="#c7d9d3"/>
        <path d="M160 158Q226 188 329 166Q252 199 185 175Z" fill="#f7efda" stroke="none"/>
        <path d="M202 133Q219 152 200 174M239 136L229 161M271 135L261 164M301 141L292 164" fill="none" stroke="#95ada6"/>
        <path d="M231 164L257 184L261 165" fill="#9cb8b5"/>
        <circle cx="179" cy="148" r="5" fill="#fff9e9"/><circle cx="178" cy="148" r="2.6" fill="#3b5659" stroke="none"/>
        <path d="M155 156L168 158" fill="none"/>
      </g>
      <g class="fish-ginger" fill="#ead18a" stroke="#c1a45d" stroke-width="1.4"><path d="M225 137l31 18-4 6-31-18Z"/><path d="M266 132l28 18-4 6-29-18Z"/><path d="M289 154l28 12-3 6-29-12Z"/></g>
      <g class="fish-scallions" fill="none" stroke="#588762" stroke-width="4" stroke-linecap="round"><path d="M215 153q45-25 94 3"/><path d="M231 162q33-32 66-20"/><path d="M242 139q-5 23 54 26"/><path d="M269 145q21-18 42-7"/></g>
    </g>
    <g class="fish-pot-front"><path d="M128 174Q270 222 412 174V203Q412 231 385 231H155Q128 231 128 203Z" fill="#aac1bf" stroke="#64858d" stroke-width="2"/><path d="M143 189Q270 225 397 189" fill="none" stroke="#dce7de" stroke-width="3"/><path d="M151 211H177M194 215H220M237 216H263M280 216H306M323 215H349M366 211H389" stroke="#779b9d" stroke-width="3" stroke-linecap="round"/></g>
    <g class="fish-rinse" fill="#91c4d1" stroke="none"><path d="M206 72q-12 18 0 19q12-1 0-19Z"/><path d="M240 57q-12 18 0 19q12-1 0-19Z"/><path d="M274 72q-12 18 0 19q12-1 0-19Z"/></g>
    <g class="fish-lid"><path d="M245 104V94Q270 67 295 94V104" fill="none" stroke="#567781" stroke-width="8"/><path d="M128 162Q152 104 270 101Q388 104 412 162Z" fill="#c9dad4" stroke="#64858d" stroke-width="2"/><path d="M153 151Q184 116 241 115" fill="none" stroke="#f7f6e5" stroke-width="5" stroke-linecap="round"/><ellipse cx="270" cy="164" rx="142" ry="20" fill="#adc8c8" stroke="#64858d" stroke-width="2"/><path d="M150 165Q270 189 389 165" fill="none" stroke="#e5efdf" stroke-width="3"/></g>
    <g class="fish-steam" fill="none" stroke="#91b3b7" stroke-width="4" stroke-linecap="round"><path d="M201 99q-13-15 0-27t0-26"/><path d="M270 76q13-15 0-27t0-24"/><path d="M339 99q13-15 0-27t0-26"/></g>
    <g class="fish-seasoning"><path class="fish-pour" d="M414 108Q388 137 347 154" fill="none" stroke="#ae7b43" stroke-width="4" stroke-linecap="round"/><g class="fish-sauce-bowl"><path d="M399 78H464Q463 110 432 110Q402 108 399 78Z" fill="#9dbbc0" stroke="#65858d" stroke-width="2"/><ellipse cx="432" cy="78" rx="33" ry="8" fill="#e8efdf" stroke="#65858d"/><ellipse cx="431" cy="79" rx="23" ry="4" fill="#ad7944" stroke="none"/></g></g>
  </svg>`
};
