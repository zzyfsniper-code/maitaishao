import { steamedFish } from './steamed-fish-scene.js';

const stages = ['备菜', '下锅', '翻炒', '出锅'];
const cues = ['先切好备着，火候才不慌。', '食材下锅，香气就来了。', '翻一翻，让滋味慢慢相遇。', '出锅，上桌，趁热吃。'];

class CookingScene extends HTMLElement {
  connectedCallback() {
    delete this.dataset.stage;
    const fish = this.getAttribute('recipe-name') === '清蒸鲈鱼';
    this.dataset.recipe = fish ? 'steamed-fish' : 'generic';
    const labels = fish ? steamedFish.stages : stages;
    this.cues = fish ? steamedFish.cues : cues;
    this.ends = fish ? steamedFish.ends : [850, 1500, 2850, 3950];
    this.mins = fish ? steamedFish.mins : null;
    this.chef = 'dad';
    const chefAssets = { dad: './assets/fish-chef-dad.png', mom: './assets/fish-chef-mom.png' };
    const fishArt = fish ? steamedFish.artwork.replace('<rect x="54" y="240"', `<svg x="0" y="0" width="540" height="240" overflow="hidden"><image class="cooking-chef" href="${chefAssets.dad}" x="-8" y="4" width="300" height="330" preserveAspectRatio="xMidYMax meet"/></svg><rect x="54" y="240"`) : '';
    this.innerHTML = `<section class="cooking-scene" aria-label="${fish ? '清蒸鲈鱼专属烹饪示意动画' : '四步烹饪示意动画'}">
      <div class="cooking-intro"><div><span class="cooking-eyebrow">买 · 汰 · 烧</span>${fish ? '<b class="cooking-chef-name">爸爸掌勺</b>' : '<p class="cooking-cue"></p>'}</div><div class="cooking-controls">${fish ? '<div class="cooking-chef-pick" role="group" aria-label="选择掌勺人"><button type="button" data-chef="dad" aria-pressed="true">爸爸</button><button type="button" data-chef="mom" aria-pressed="false">妈妈</button></div>' : ''}<button type="button" class="button small cooking-replay">再做一次 ↻</button></div></div>
      <div class="cooking-stage">
        ${fish ? '' : '<div class="cooking-host"><img src="./assets/maitaishao-icon-v2.png" alt="买汰烧主厨形象"><span>今天我掌勺</span></div>'}
        ${fish ? fishArt : `<svg class="cooking-stove" viewBox="0 0 540 230" aria-hidden="true">
          <ellipse cx="285" cy="209" rx="215" ry="15" fill="#d8c4aa" opacity=".32"/>
          <path d="M34 189H514V202H34Z" fill="#d9b991"/><rect x="34" y="182" width="480" height="10" rx="5" fill="#ebd4b4"/>
          <g class="prep-board"><rect x="54" y="149" width="123" height="18" rx="8" fill="#c58f59"/><path d="M65 154H166" stroke="#efd4b4" stroke-width="2"/>
            <g class="prep-bits" fill="#73a578"><rect x="88" y="136" width="17" height="10" rx="3"/><rect x="111" y="140" width="12" height="8" rx="3"/><rect x="132" y="135" width="16" height="11" rx="3"/></g>
            <g class="cooking-knife"><path d="M84 108H145V131Q112 136 84 125Z" fill="#a7b8bc"/><path d="M84 107H144" stroke="#edf5ef" stroke-width="3"/><rect x="139" y="104" width="38" height="12" rx="5" fill="#64564b"/></g>
          </g>
          <g class="burner"><rect x="231" y="164" width="160" height="20" rx="8" fill="#5b777c"/><rect x="242" y="167" width="138" height="5" rx="2" fill="#8ba6a6"/><circle cx="370" cy="177" r="3" fill="#f6e3c6"/></g>
          <g class="cooking-fire"><path d="M270 162Q254 148 273 134Q270 146 283 147Q294 127 301 123Q298 141 312 143Q325 129 326 138Q347 151 333 162Z" fill="#d97848"/><path d="M286 164Q275 151 292 143Q292 153 303 147Q315 139 317 150Q328 158 316 164Z" fill="#f6c66b"/></g>
          <g class="cooking-pan"><path d="M350 111L442 85" stroke="#5f5145" stroke-width="15" stroke-linecap="round"/><path d="M252 109Q251 160 310 160Q365 160 368 109Z" fill="#574c40"/><ellipse cx="310" cy="108" rx="60" ry="13" fill="#776657"/><ellipse class="pan-oil" cx="310" cy="109" rx="41" ry="8" fill="#cba35d" opacity=".5"/>
            <g class="pan-food">
              <g class="food-piece piece-1"><path d="M275 109q9-15 17-1l-4 8Z" fill="#78a55c"/></g>
              <g class="food-piece piece-2"><path d="M305 102l15 3-3 8-16-4Z" fill="#d5784f"/></g>
              <g class="food-piece piece-3"><path d="M328 107q12-12 16 1l-11 7Z" fill="#e6b654"/></g>
              <g class="food-piece piece-4"><ellipse cx="299" cy="114" rx="9" ry="4" fill="#e4c3a1"/></g>
              <g class="food-piece piece-5"><path d="M316 117l12-7 4 6-13 6Z" fill="#83a66b"/></g>
            </g>
          </g>
          <g class="cooking-steam" fill="none" stroke="#a4b9af" stroke-width="3" stroke-linecap="round"><path d="M286 84q-12-13 0-24t0-24"/><path d="M309 76q13-13 0-24t0-24"/><path d="M333 84q-12-13 0-24t0-24"/></g>
          <g class="cooking-plate"><ellipse cx="431" cy="172" rx="54" ry="12" fill="#faf4e5" stroke="#9eafb0" stroke-width="3"/><ellipse cx="431" cy="169" rx="38" ry="7" fill="#dfe9dc"/><path d="M402 166l14-9 13 7 16-12 16 16Z" fill="#6b965d"/><path d="M420 163l9-8 11 6 12 7-24 2Z" fill="#d97b4e"/></g>
        </svg>`}
        ${fish ? '<div class="cue-bar"><span class="cue-time"><small>参考</small><b></b><span>分钟</span></span><p class="cooking-cue"></p></div>' : ''}
      </div>
      <ol class="cooking-steps">${labels.map((s, i) => `<li data-step-index="${i}"><span>${i + 1}</span>${fish ? `<span class="cooking-step-label">${s}<small>约 ${this.mins[i]} 分钟</small></span>` : s}</li>`).join('')}</ol>
      ${fish ? `<p class="cue-total">本菜示例用时约 <b>${this.mins.reduce((a, b) => a + b, 0)}</b> 分钟</p>` : ''}
      <p class="cooking-footnote">${this.hasAttribute('loading') ? '厨房准备好后，将自动为你打开。' : fish ? '示例时长 · 实际按鱼的大小与火力蒸至熟透，以下方菜谱为准' : '烹饪示意 · 实际做法和时间以下方菜谱为准'}</p><span class="visually-hidden cooking-status" role="status"></span>
    </section>`;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.onMotion = () => this.play();
    this.onClose = () => { this.stop(); this.setStage(4); };
    this.dialog = this.closest('dialog');
    this.dialog?.addEventListener('close', this.onClose);
    this.motion.addEventListener('change', this.onMotion);
    this.querySelector('.cooking-replay').addEventListener('click', () => this.play());
    this.querySelectorAll('[data-chef]').forEach(button => button.addEventListener('click', () => {
      this.chef = button.dataset.chef;
      this.querySelector('.cooking-chef').setAttribute('href', chefAssets[this.chef]);
      this.querySelector('.cooking-chef-name').textContent = this.chef === 'mom' ? '妈妈掌勺' : '爸爸掌勺';
      this.querySelectorAll('[data-chef]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    }));
    this.play();
  }
  disconnectedCallback() {
    this.stop(); this.motion?.removeEventListener('change', this.onMotion);
    this.dialog?.removeEventListener('close', this.onClose);
  }
  stop() { cancelAnimationFrame(this.frame); }
  setStage(stage) {
    if (this.dataset.stage === String(stage)) return;
    this.dataset.stage = stage;
    this.querySelector('.cooking-cue').textContent = this.cues[Math.min(stage, 3)];
    if (this.mins) this.querySelector('.cue-time b').textContent = this.mins[Math.min(stage, 3)];
    this.querySelectorAll('.cooking-steps li').forEach((el, i) => {
      el.classList.toggle('current', i === Math.min(stage, 3));
      el.classList.toggle('complete', i < stage);
      if (i === Math.min(stage, 3)) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    this.querySelector('.cooking-status').textContent = stage === 4 && !this.hasAttribute('loading') ? '烹饪示意播放完成。' : '';
  }
  play() {
    this.stop();
    if (this.motion.matches) { this.setStage(4); return; }
    const start = performance.now();
    const tick = now => {
      const elapsed = this.hasAttribute('loading') ? (now - start) % (this.ends[3] + 600) : now - start;
      this.setStage(elapsed < this.ends[0] ? 0 : elapsed < this.ends[1] ? 1 : elapsed < this.ends[2] ? 2 : elapsed < this.ends[3] ? 3 : 4);
      if ((this.hasAttribute('loading') || elapsed < this.ends[3]) && this.isConnected) this.frame = requestAnimationFrame(tick);
    };
    this.setStage(0); this.frame = requestAnimationFrame(tick);
  }
}
customElements.define('cooking-scene', CookingScene);
