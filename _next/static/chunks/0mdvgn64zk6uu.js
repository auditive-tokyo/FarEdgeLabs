(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,48097,84833,e=>{"use strict";let t;var r=e.i(71645);let i={width:0,height:0},a=()=>({width:window.innerWidth,height:window.innerHeight}),n=a(),s=new Set,l=!1,o=()=>{let e=a();(e.width!==n.width||e.height!==n.height)&&(n=e,s.forEach(e=>e()))},c=()=>{t&&clearTimeout(t),t=setTimeout(o,300)},d=e=>(l||(n=a(),window.addEventListener("resize",c,{passive:!0}),l=!0),s.add(e),()=>{s.delete(e),0===s.size&&(window.removeEventListener("resize",c),t&&clearTimeout(t),l=!1)});e.s(["useWindowSize",0,function(){return(0,r.useSyncExternalStore)(d,()=>n,()=>i)},"useWindowWidth",0,function(){return(0,r.useSyncExternalStore)(d,()=>n.width,()=>i.width)}],48097),e.i(6685),e.i(92655),e.s([],84833)},223,e=>{"use strict";var t=e.i(43476);e.i(48787);var r=e.i(65658),i=e.i(71645);let a=new Set,n=null,s=e=>{for(let t of[...a])if(a.has(t)&&!(e-t.last<=t.getFramerate())){t.last=e;try{t.callback(e)}catch(e){console.error("[ticker] subscriber threw:",e)}}n=requestAnimationFrame(s)},l="(pointer: coarse)",o=e=>{let t=window.matchMedia(l);return t.addEventListener("change",e),()=>t.removeEventListener("change",e)},c="(prefers-reduced-motion: reduce)",d=e=>{let t=window.matchMedia(c);return t.addEventListener("change",e),()=>t.removeEventListener("change",e)};var u=e.i(48097);let f=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i,h=/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i,m=(e,t,r)=>(e=>{let t=e.trim(),r=f.exec(t);if(r){let e,t=3===(e=r[1]).length?e.split("").map(e=>e+e).join(""):e;return[0,2,4].map(e=>parseInt(t.slice(e,e+2),16)/255)}let i=h.exec(t);return i?[1,2,3].map(e=>Math.min(Number(i[e])/255,1)):null})(getComputedStyle(e).getPropertyValue(t))??r,v=(e,t,r,i,a)=>i+(Math.min(Math.max(e,t),r)-t)/(r-t)*(a-i),g=1/60,p=(e,t)=>new Promise(r=>{if(1e-4>Math.abs(e.currentTime-t))return void r();let i=()=>{e.removeEventListener("seeked",i),r()};e.addEventListener("seeked",i),e.currentTime=t}),b=async({video:e,count:t,onFrame:r,isCancelled:i})=>{if(!Number.isFinite(e.duration)||t<2)return;let a=Math.round(320*e.videoHeight/e.videoWidth),n=Math.max(e.duration-g,0);for(let s=0;s<t;s+=1){if(i()||(await p(e,s/(t-1)*n),i()))return;let l=await createImageBitmap(e,{resizeWidth:320,resizeHeight:a,resizeQuality:"high",imageOrientation:"flipY"});if(i())return void l.close();r(l,s)}await p(e,0)},w=`#version 300 es

in vec2 a_position;
out vec2 v_uv;

void main() {
  // Clip space (-1..1) -> uv (0..1). v_uv.y is 1 at the top of the screen,
  // which matches the flipped-Y texture upload (see halftone-renderer.ts).
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`,x=`#version 300 es

precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;

uniform vec2 u_resolution;   // canvas size, device px
uniform vec2 u_sourceSize;   // intrinsic source size, px
uniform float u_cell;        // dot cell size, device px
uniform float u_gain;        // exposure applied to the sampled luminance
uniform float u_gamma;       // <1 lifts midtones into larger dots
uniform float u_dotScale;    // dot diameter at full brightness, in cells
uniform float u_softness;    // extra edge blur beyond antialiasing, in cells
uniform float u_mirror;      // 1 = flip the sampled image horizontally
uniform vec2 u_tilt;         // perspective lean, per axis; 0 = flat on
uniform float u_inkSpread;   // how tightly the ink ramp packs around the centre
uniform float u_reveal;      // 0..1 — the developing wave's travel, bottom to top
uniform float u_revealBand;  // wave thickness, in screen heights
uniform vec3 u_inkLight;     // ramp start
uniform vec3 u_inkMid;       // ramp middle
uniform vec3 u_inkDeep;      // ramp end
uniform vec3 u_bg;

/** Maps uv so the texture covers the canvas — the CSS \`object-fit: cover\` rule. */
vec2 coverUv(vec2 uv, vec2 canvas, vec2 tex) {
  float canvasAspect = canvas.x / canvas.y;
  float texAspect = tex.x / tex.y;
  vec2 scale = canvasAspect > texAspect
    ? vec2(1.0, texAspect / canvasAspect)
    : vec2(canvasAspect / texAspect, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Reads the picture off a plane leaning away from the viewer.
 *
 * A projective divide, not a skew: the far side compresses and the near side
 * spreads, which is what sells it as depth rather than a squash. Only the
 * *sample* position moves — the dot grid stays screen-aligned, so the field
 * keeps its even texture instead of foreshortening into uneven dots.
 */
vec2 leanUv(vec2 uv, vec2 tilt) {
  vec2 centred = uv - 0.5;
  // Guarded because w <= 0 would turn the plane inside out; in practice tilt
  // stays small enough that it never comes close.
  float w = max(1.0 + dot(centred, tilt), 0.2);
  return centred / w + 0.5;
}

void main() {
  vec2 cells = max(u_resolution / u_cell, vec2(1.0));
  vec2 cellCenter = (floor(v_uv * cells) + 0.5) / cells;
  vec2 inCell = fract(v_uv * cells);

  // One sample per cell, at its centre — the whole cell shares that value, so
  // each dot reads as a single mark rather than a window on the video.
  // Lean first (screen space), then mirror (image space), so the lean follows
  // the pointer the same way whichever direction the subject faces.
  vec2 leaned = leanUv(cellCenter, u_tilt);
  vec2 sampleAt = vec2(u_mirror > 0.5 ? 1.0 - leaned.x : leaned.x, leaned.y);
  vec2 uv = coverUv(sampleAt, u_resolution, u_sourceSize);
  vec3 src = texture(u_source, clamp(uv, 0.0, 1.0)).rgb;
  float lum = pow(clamp(luma(src) * u_gain, 0.0, 1.0), u_gamma);

  // The developing wave. v_uv.y is 1 at the top, so the front climbs from the
  // bottom edge (0) to past the top (1 + band): at u_reveal = 0 nothing has
  // arrived, at 1 every cell has fully settled. The front starts *at* the
  // bottom, not below it — start it off-screen and the first fifth of the
  // travel is spent crossing a gap nobody can see, which reads as the page
  // hanging before anything happens.
  float front = u_reveal * (1.0 + u_revealBand);
  // A gentle S across the width, so the wave reads as a tide rather than a
  // ruler drawn up the screen.
  float wobble = sin(cellCenter.x * 6.2831853) * 0.02;
  float local = clamp(
    (front - (cellCenter.y + wobble)) / max(u_revealBand, 1e-4),
    0.0,
    1.0
  );
  // Each cell simply grows into its own brightness as the front passes, so the
  // subject develops out of the paper bottom-first and nothing appears where the
  // picture is empty. Deliberately *not* a crest that swells dots past their
  // settled size: that puts a band of ink across the full width, background
  // included, and a soft bar sweeping up the screen reads as a blur artefact
  // rather than as a subject arriving.
  lum *= local;

  // Half a device pixel, in cell units: the least feather that still resolves
  // the dot's edge without stair-stepping it. u_softness blurs beyond that; at
  // 0 the dot is as crisp as the pixel grid allows.
  float feather = max(u_softness, 0.5 / max(u_cell, 1.0));
  // Cap the radius so the *feathered* edge still lands inside the cell. Past
  // that the cell bounds clip the dot and it reads as a square — reintroducing
  // the hard corners this effect exists to avoid.
  float maxRadius = max(0.5 - feather, 0.0);
  // Radius varies continuously with brightness — no ramp steps, so a dot grows
  // smoothly instead of popping between sizes as the clip plays. It starts at
  // -feather so an unlit cell resolves to nothing rather than to a half-lit
  // speck once the edge is feathered.
  float radius = mix(-feather, maxRadius * clamp(u_dotScale, 0.0, 1.0), lum);
  float mask = 1.0 - smoothstep(
    -feather,
    feather,
    length(inCell - 0.5) - radius
  );

  // The ramp is keyed to *where the cell sits*, not how bright it is.
  // Brightness already sets the dot's size, so a luminance-keyed ramp hands its
  // light end to exactly the cells too small to show it — every dot you can
  // actually see lands on the dark end, and the field reads as one flat colour.
  float diagonal = (cellCenter.x + (1.0 - cellCenter.y)) * 0.5;
  // Spread packs the ramp around the middle of the frame, where the subject
  // is. Left at 1.0 the subject only ever covers the ramp's middle and the
  // outer stops never appear.
  float t = clamp(0.5 + (diagonal - 0.5) * u_inkSpread, 0.0, 1.0);
  vec3 ink = mix(
    mix(u_inkLight, u_inkMid, clamp(t * 2.0, 0.0, 1.0)),
    u_inkDeep,
    clamp(t * 2.0 - 1.0, 0.0, 1.0)
  );

  fragColor = vec4(mix(u_bg, ink, mask), 1.0);
}
`,E=new Float32Array([-1,-1,1,-1,-1,1,1,1]),_=(e,t,r)=>{let i=e.createShader(t);return i?(e.shaderSource(i,r),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS))?i:(console.error("[halftone-video] shader compile failed:",e.getShaderInfoLog(i)),e.deleteShader(i),null):null},y={tension:120,friction:26},L=1/60,R={tension:40,friction:26},T={bg:[1,1,1],inkLight:[.62,.8,.91],inkMid:[.25,.39,.82],inkDeep:[.23,.11,.43]},S=({src:e,cellSize:f=9,dotScale:h=.72,softness:g=0,gain:p=1.9,gamma:S=.62,mirror:k=!1,tilt:A=0,inkSpread:N=2.5,pointerScrub:M=!1,scrubFrames:I=60,reveal:j=!0,revealBand:U=.28,className:D="fixed inset-0 -z-10"})=>{let P=(0,i.useRef)(null),z=(0,i.useRef)(null),C=(0,i.useRef)(null),W=(0,i.useRef)([]),O=(0,i.useRef)(T),F=(0,i.useRef)(1),[B,V]=(0,i.useState)(!0),H=(0,i.useSyncExternalStore)(d,()=>window.matchMedia(c).matches,()=>!1),G=(0,i.useSyncExternalStore)(o,()=>window.matchMedia(l).matches,()=>!1),{width:X,height:Y}=(0,u.useWindowSize)(),K=M&&!G,q=M&&G,[{progress:Q,tiltX:$,tiltY:J},Z]=(0,r.useSpring)(()=>({progress:.5,tiltX:0,tiltY:0,config:y})),{wave:ee}=(0,r.useSpring)({from:{wave:0},wave:+!!j,config:R});(0,i.useEffect)(()=>{let e=z.current;if(!e)return;let t=()=>{O.current={bg:m(e,"--halftone-bg",T.bg),inkLight:m(e,"--halftone-ink-light",T.inkLight),inkMid:m(e,"--halftone-ink-mid",T.inkMid),inkDeep:m(e,"--halftone-ink-deep",T.inkDeep)}};t();let r=window.matchMedia("(prefers-color-scheme: dark)");return r.addEventListener("change",t),()=>r.removeEventListener("change",t)},[]),(0,i.useEffect)(()=>{let e=z.current;if(!e)return;F.current=Math.min(window.devicePixelRatio||1,1.5);let t=(({canvas:e})=>{let t=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:"high-performance"});if(!t)return null;let r=(e=>{let t=_(e,e.VERTEX_SHADER,w),r=_(e,e.FRAGMENT_SHADER,x);if(!t||!r)return null;let i=e.createProgram();return i?(e.attachShader(i,t),e.attachShader(i,r),e.linkProgram(i),e.deleteShader(t),e.deleteShader(r),e.getProgramParameter(i,e.LINK_STATUS))?i:(console.error("[halftone-video] program link failed:",e.getProgramInfoLog(i)),e.deleteProgram(i),null):null})(t);if(!r)return null;let i={source:t.getUniformLocation(r,"u_source"),resolution:t.getUniformLocation(r,"u_resolution"),sourceSize:t.getUniformLocation(r,"u_sourceSize"),cell:t.getUniformLocation(r,"u_cell"),gain:t.getUniformLocation(r,"u_gain"),gamma:t.getUniformLocation(r,"u_gamma"),dotScale:t.getUniformLocation(r,"u_dotScale"),softness:t.getUniformLocation(r,"u_softness"),mirror:t.getUniformLocation(r,"u_mirror"),tilt:t.getUniformLocation(r,"u_tilt"),inkSpread:t.getUniformLocation(r,"u_inkSpread"),reveal:t.getUniformLocation(r,"u_reveal"),revealBand:t.getUniformLocation(r,"u_revealBand"),bg:t.getUniformLocation(r,"u_bg"),inkLight:t.getUniformLocation(r,"u_inkLight"),inkMid:t.getUniformLocation(r,"u_inkMid"),inkDeep:t.getUniformLocation(r,"u_inkDeep")},a=t.createVertexArray();t.bindVertexArray(a);let n=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,n),t.bufferData(t.ARRAY_BUFFER,E,t.STATIC_DRAW);let s=t.getAttribLocation(r,"a_position");t.enableVertexAttribArray(s),t.vertexAttribPointer(s,2,t.FLOAT,!1,0,0),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!0);let l=t.createTexture();t.bindTexture(t.TEXTURE_2D,l),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.useProgram(r),t.uniform1i(i.source,0);let o=NaN;return{resize:(r,i)=>{e.width=r,e.height=i,t.viewport(0,0,r,i)},render:n=>{t.useProgram(r),t.bindVertexArray(a),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,l),n.sourceKey!==o&&(o=n.sourceKey,t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,n.source)),t.uniform2f(i.resolution,e.width,e.height),t.uniform2f(i.sourceSize,n.sourceSize[0],n.sourceSize[1]),t.uniform1f(i.cell,n.cell),t.uniform1f(i.gain,n.gain),t.uniform1f(i.gamma,n.gamma),t.uniform1f(i.dotScale,n.dotScale),t.uniform1f(i.softness,n.softness),t.uniform1f(i.mirror,+!!n.mirror),t.uniform2f(i.tilt,n.tilt[0],n.tilt[1]),t.uniform1f(i.inkSpread,n.inkSpread),t.uniform1f(i.reveal,n.reveal),t.uniform1f(i.revealBand,n.revealBand),t.uniform3fv(i.bg,n.bg),t.uniform3fv(i.inkLight,n.inkLight),t.uniform3fv(i.inkMid,n.inkMid),t.uniform3fv(i.inkDeep,n.inkDeep),t.drawArrays(t.TRIANGLE_STRIP,0,4)},dispose:()=>{t.deleteTexture(l),t.deleteBuffer(n),t.deleteVertexArray(a),t.deleteProgram(r)}}})({canvas:e});return t?(C.current=t,t.resize(Math.round(window.innerWidth*F.current),Math.round(window.innerHeight*F.current)),()=>{C.current=null,t.dispose()}):void V(!1)},[]),(0,i.useEffect)(()=>{let e=P.current;if(e){if(e.muted=!0,H)return void e.pause();e.play().catch(()=>{})}},[H]),(0,i.useEffect)(()=>{let e=P.current;if(!M||!e)return;let t=!1,r=[],i=()=>t;return(async()=>{if((e.readyState<e.HAVE_CURRENT_DATA&&await new Promise(t=>{let r=()=>{e.removeEventListener("loadeddata",r),t()};e.addEventListener("loadeddata",r)}),!t)&&(e.pause(),K))try{await b({video:e,count:I,isCancelled:i,onFrame:e=>{r.push(e),W.current=r}})}catch(e){console.error("[halftone-video] frame capture failed:",e)}})(),()=>{t=!0,W.current=[],r.forEach(e=>e.close())}},[M,K,I,e]);let et=M||0!==A;return(0,i.useEffect)(()=>{if(!et)return;let e=e=>Z.start({progress:v(e.clientX,0,window.innerWidth,0,1),tiltX:v(e.clientX,0,window.innerWidth,-1,1),tiltY:v(e.clientY,0,window.innerHeight,-1,1)});return window.addEventListener("pointerdown",e,{passive:!0}),window.addEventListener("pointermove",e,{passive:!0}),()=>{window.removeEventListener("pointerdown",e),window.removeEventListener("pointermove",e)}},[et,Z]),(0,i.useEffect)(()=>{if(!X||!Y)return;let e=F.current;C.current?.resize(Math.round(X*e),Math.round(Y*e))},[X,Y]),((e,t={})=>{let r=(0,i.useRef)(e),l=(0,i.useRef)(t);(0,i.useEffect)(()=>{r.current=e,l.current=t}),(0,i.useEffect)(()=>{let e;l.current.onMount?.();let t=(e={callback:e=>r.current(e),getFramerate:()=>l.current.framerate??100,last:performance.now()},a.add(e),null===n&&(n=requestAnimationFrame(s)),()=>{a.delete(e),0===a.size&&null!==n&&(cancelAnimationFrame(n),n=null)});return()=>{t(),l.current.onUnMount?.()}},[])})(()=>{let e=C.current,t=P.current;if(!e||!t)return;let r={cell:f*F.current,dotScale:h,reveal:ee.get(),revealBand:U,softness:g,gain:p,gamma:S,mirror:k,tilt:[$.get()*A,J.get()*A],inkSpread:N,...O.current};if(q&&!t.seeking&&Number.isFinite(t.duration)){let e=Q.get()*Math.max(t.duration-L,0);Math.abs(t.currentTime-e)>L&&(t.currentTime=e)}let i=W.current;if(K&&i.length){let t=Math.max(Math.min(Math.round(Q.get()*(I-1)),i.length-1),0),a=i[t];e.render({...r,source:a,sourceKey:t,sourceSize:[a.width,a.height]});return}t.readyState<t.HAVE_CURRENT_DATA||t.videoWidth&&t.videoHeight&&e.render({...r,source:t,sourceKey:t.currentTime,sourceSize:[t.videoWidth,t.videoHeight]})},{framerate:0}),(0,t.jsxs)("div",{"aria-hidden":"true",className:D,children:[(0,t.jsx)("video",{ref:P,src:e,className:"size-full object-cover",loop:!0,muted:!0,playsInline:!0,preload:"auto"}),B&&(0,t.jsx)("canvas",{ref:z,className:"absolute inset-0 size-full bg-halftone-bg"})]})};e.i(84833);var k=e.i(92655);e.s(["HeroField",0,({src:e})=>{let r=(0,k.useIntroRevealed)();return(0,t.jsx)(S,{src:e,pointerScrub:!0,mirror:!0,tilt:.24,reveal:r})}],223)},79050,e=>{"use strict";let t={mobileWidth:768,disableOnMobile:{hover:!0,inview:!1,spring:!1,springtrigger:!1}};e.s(["isMobileDisabled",0,(e,r)=>!!e&&(r&&r>0?r:window.innerWidth)<=t.mobileWidth,"springsConfig",0,t])},2830,e=>{"use strict";var t=e.i(71645);e.s(["useDynamicInView",0,(e={})=>{let[r,i]=(0,t.useState)(null),[a,n]=(0,t.useState)(!1),s=(0,t.useRef)(!1),{trigger:l,root:o,rootMargin:c,threshold:d,onEnter:u,onLeave:f}=e,h=(0,t.useRef)(u),m=(0,t.useRef)(f);return(0,t.useEffect)(()=>{h.current=u,m.current=f}),(0,t.useEffect)(()=>{let e=l?.current??r;if(!e)return;let t=new IntersectionObserver(([e])=>{let t=e.isIntersecting;s.current=t,n(t),t?h.current?.(e):m.current?.(e)},{root:o,rootMargin:c,threshold:d});return t.observe(e),()=>t.disconnect()},[r,l,o,c,d]),[i,a,s]}])},80956,71543,e=>{"use strict";var t=e.i(43476),r=e.i(48787),i=e.i(65658),a=e.i(71645),n=e.i(2830),s=e.i(79050),l=e.i(48097);let o=(0,a.forwardRef)(({tag:e="span",children:i,className:n,style:s,...l},o)=>{let c=(0,a.useRef)(null);(0,a.useImperativeHandle)(o,()=>c.current);let d=r.animated[e];return(0,t.jsx)(d,{ref:c,className:n,style:s,...l,children:i})});o.displayName="AnimatedVarTextTag";let c=(0,a.forwardRef)(({tag:e="div",children:r,from:c={},to:d={},mode:u="always",style:f,config:h={},delayIn:m=0,delayOut:v=0,enabled:g=!0,innerTag:p,trigger:b,innerClassName:w,disableOnMobile:x=!1,immediateOut:E=!0,..._},y)=>{let L=(0,a.useRef)(null),[R,T]=(0,n.useDynamicInView)({trigger:b}),S=(0,a.useRef)(!1),k=(0,a.useRef)(!1),A=(0,l.useWindowWidth)();(0,a.useImperativeHandle)(y,()=>L.current),(0,a.useEffect)(()=>{if(!(0,s.isMobileDisabled)(s.springsConfig.disableOnMobile.inview||x,A)&&"forward"===u){let e=()=>{L.current&&(L.current.getBoundingClientRect().top>0?k.current=!1:k.current=!0)};return window.addEventListener("scroll",e,{passive:!0}),()=>window.removeEventListener("scroll",e)}},[u,x,A]);let N=(0,a.useMemo)(()=>!(0,s.isMobileDisabled)(s.springsConfig.disableOnMobile.inview||x,A)&&!!g&&("once"===u&&!!S.current||"forward"===u&&!!k.current||(S.current||(S.current=T),T)),[T,u,g,x,A]),M=(0,i.useSpring)({from:c,to:N?d:c,config:h,delay:N?m:v,immediate:!N&&E});return p?(0,t.jsx)(o,{tag:e,ref:e=>{L.current=e,R(e)},style:{...f},..._,children:(0,t.jsx)(o,{tag:p,className:w,style:{...M},children:r})}):(0,t.jsx)(o,{tag:e,ref:e=>{L.current=e,R(e)},style:{...M,...f},..._,children:r})});c.displayName="Inview",e.s(["Inview",0,c],80956),e.s(["HOVER_SPRING",0,{tension:240,friction:30},"LETTER_IN",0,{opacity:1,x:"0rem",filter:"blur(0rem)"},"LETTER_OUT",0,{opacity:0,x:"-1.25rem",filter:"blur(0.625rem)"},"LETTER_STAGGER",0,26,"LIFT_IN",0,{opacity:1,y:"0rem"},"LIFT_OUT",0,{opacity:0,y:"1rem"},"REVEAL_DELAY",0,{headline:200,brand:320,nav:400,rule:420,cta:480,lead:500,stats:560,body:620,headlineBar:1100},"REVEAL_SPRING",0,{tension:80,friction:26},"WORD_IN",0,{opacity:1,y:"0rem",filter:"blur(0rem)"},"WORD_OUT",0,{opacity:0,y:"0.875rem",filter:"blur(0.5rem)"},"WORD_STAGGER",0,45],71543)},4170,e=>{"use strict";var t=e.i(43476),r=e.i(22016),i=e.i(48787),a=e.i(65658),n=e.i(71645),s=e.i(79050),l=e.i(48097);let o=(0,n.forwardRef)(({tag:e="span",children:r,className:a,style:s,...l},o)=>{let c=(0,n.useRef)(null);(0,n.useImperativeHandle)(o,()=>c.current);let d=i.animated[e];return(0,t.jsx)(d,{ref:c,className:a,style:s,...l,children:r})});o.displayName="AnimatedVarTextTag";let c=(0,n.forwardRef)(({tag:e="div",children:r,from:i={},to:c={},style:d,config:u={},delayIn:f=0,delayOut:h=0,enabled:m=!0,trigger:v,disableOnMobile:g=!0,immediateOut:p=!1,...b},w)=>{let x=(0,n.useRef)(null),[E,_]=(0,n.useState)(!1),y=(0,l.useWindowWidth)();(0,n.useImperativeHandle)(w,()=>x.current),(0,n.useEffect)(()=>{if((0,s.isMobileDisabled)(s.springsConfig.disableOnMobile.hover||g,y))return;let e=v?.current;if(!e)return;let t=()=>{_(!0)},r=()=>{_(!1)};return e.addEventListener("mouseenter",t),e.addEventListener("mouseleave",r),()=>{e.removeEventListener("mouseenter",t),e.removeEventListener("mouseleave",r)}},[v,g,y]);let L=(0,n.useMemo)(()=>!(0,s.isMobileDisabled)(s.springsConfig.disableOnMobile.hover||g,y)&&!!m&&E,[m,E,g,y]),R=(0,a.useSpring)({from:i,to:L?c:i,config:u,delay:L?f:h,immediate:!L&&p});return(0,t.jsx)(o,{ref:x,onMouseEnter:()=>{(0,s.isMobileDisabled)(s.springsConfig.disableOnMobile.hover||g)||v?.current||_(!0)},onMouseLeave:()=>{(0,s.isMobileDisabled)(s.springsConfig.disableOnMobile.hover||g)||v?.current||_(!1)},tag:e,style:{...R,...d},...b,children:r})});c.displayName="Hover";var d=e.i(80956);e.i(84833);var u=e.i(92655);[{maxWidth:1440,baseWidth:1440}].map(e=>e.maxWidth);var f=e.i(31973);let h={tension:110,friction:24,clamp:!0},m=({nav:e})=>{let[s,o]=(0,n.useState)(!1),c=(0,n.useId)(),d=(0,n.useRef)(null),u=(0,f.useScroll)(e=>e.stop),m=(0,f.useScroll)(e=>e.start),v=(0,l.useWindowWidth)(),g=()=>o(!1);(0,n.useEffect)(()=>{v>=1024&&o(!1)},[v]),(0,n.useEffect)(()=>{if(!s)return;u();let e=d.current,t=e=>{"Escape"===e.key&&o(!1)};return window.addEventListener("keydown",t),()=>{window.removeEventListener("keydown",t),m(),e?.focus()}},[s,u,m]);let p=(0,a.useTransition)(s,{from:{y:"-100%"},enter:{y:"0%"},leave:{y:"-100%"},config:h});return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("button",{ref:d,type:"button",onClick:()=>o(!0),"aria-expanded":s,"aria-controls":c,"aria-label":"Open menu",className:"grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-accent lg:hidden",children:(0,t.jsxs)("span",{"aria-hidden":"true",className:"flex w-5 flex-col gap-1.5",children:[(0,t.jsx)("span",{className:"h-px w-full bg-on-accent"}),(0,t.jsx)("span",{className:"h-px w-full bg-on-accent"})]})}),p((a,n)=>n&&(0,t.jsxs)(i.animated.div,{id:c,role:"dialog","aria-modal":"true","aria-label":"Menu",style:{y:a.y},className:"fixed inset-0 z-30 flex flex-col overflow-hidden bg-menu-panel px-5 pb-10 pt-24 lg:hidden",children:[(0,t.jsx)("button",{type:"button",onClick:g,"aria-label":"Close menu",className:"absolute right-2.5 top-2.5 grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-accent text-on-accent",children:(0,t.jsx)("svg",{"aria-hidden":"true",viewBox:"0 0 20 20",className:"w-5 fill-none stroke-current",strokeWidth:"1",children:(0,t.jsx)("path",{d:"M4 4l12 12M16 4L4 16"})})}),(0,t.jsx)("nav",{"aria-label":"Primary",children:(0,t.jsx)("ul",{className:"flex flex-col gap-6",children:e.map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(r.default,{href:e.href,onClick:g,className:"text-menu leading-none text-menu-ink",children:e.label})},e.href))})})]}))]})};var v=e.i(71543);let g={opacity:0,y:"-0.75rem"};e.s(["SiteHeader",0,({brand:e,nav:i,languageSwitch:a,languageHref:n})=>{let s=(0,u.useIntroRevealed)();return(0,t.jsxs)("header",{className:"fixed inset-x-2.5 top-2.5 z-20 flex items-center justify-between",children:[(0,t.jsx)(d.Inview,{tag:"div",from:g,to:v.LIFT_IN,config:v.REVEAL_SPRING,delayIn:v.REVEAL_DELAY.brand,mode:"once",enabled:s,children:(0,t.jsxs)(r.default,{href:"/",className:"flex items-center gap-2.5",children:[(0,t.jsx)("span",{className:"relative grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-surface",children:(0,t.jsx)("span",{"aria-hidden":"true",className:"size-7 rounded-full bg-[conic-gradient(from_180deg,var(--mark-sweep-from),var(--mark-sweep-to))]"})}),(0,t.jsxs)("span",{className:"text-body leading-[1.2]",children:[e.name,(0,t.jsx)("i",{children:e.nameAccent})]})]})}),(0,t.jsx)("nav",{"aria-label":"Primary",className:"absolute left-1/2 hidden -translate-x-1/2 lg:block",children:(0,t.jsx)(d.Inview,{tag:"ul",className:"flex h-[3.125rem] items-center justify-center gap-8 rounded-full border border-hairline bg-surface px-12",from:g,to:v.LIFT_IN,config:v.REVEAL_SPRING,delayIn:v.REVEAL_DELAY.nav,mode:"once",enabled:s,children:i.map((e,i)=>(0,t.jsxs)("li",{className:"flex items-center gap-8",children:[i>0&&(0,t.jsx)("span",{"aria-hidden":"true",className:"size-1 rounded-full bg-hairline-strong"}),(0,t.jsx)(r.default,{href:e.href,className:"text-body leading-[1.2]",children:e.label})]},e.href))})}),(0,t.jsxs)("div",{className:"flex items-center gap-2 lg:hidden",children:[(0,t.jsx)(r.default,{href:n,hrefLang:a.label.toLowerCase(),"aria-label":a.ariaLabel,className:"grid size-[3.125rem] place-items-center rounded-full border border-hairline bg-accent text-body leading-none text-on-accent",children:a.label}),(0,t.jsx)(m,{nav:i})]}),(0,t.jsx)(d.Inview,{tag:"div",className:"hidden lg:block",from:g,to:v.LIFT_IN,config:v.REVEAL_SPRING,delayIn:v.REVEAL_DELAY.cta,mode:"once",enabled:s,children:(0,t.jsx)(c,{tag:"div",className:"flex items-center",from:{scale:1,y:"0rem"},to:{scale:1.02,y:"-0.125rem"},config:v.HOVER_SPRING,children:(0,t.jsx)(r.default,{href:n,hrefLang:a.label.toLowerCase(),"aria-label":a.ariaLabel,className:"flex h-[3.125rem] w-[9.1875rem] items-center justify-center rounded-full border border-hairline bg-accent text-body leading-[1.2] text-on-accent",children:a.label})})})]})}],4170)}]);