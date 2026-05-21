const APP_URL = location.href;
const WS_URL = "wss://heleme-server-qjum-production.up.railway.app";
const LS_KEY = "heleme_v2";

// WebSocket
var ws = null;
var wsConnected = false;
var wsReconnectTimer = null;
window.wsData = { users: {} };

function connectWS(){
  if (ws && ws.readyState === WebSocket.OPEN) return;
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = function(){
      wsConnected = true;
      state.wsConnected = true;
      var p = state.profile || {};
      ws.send(JSON.stringify({type:"join",app:state.mode,userId:state.userId,name:p.name||"鍖垮悕",totalMl:state.totalMl,count:state.count}));
      updateWSStatus();
    };
    ws.onmessage = function(e){
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === "leaderboard" && msg.users) {
          if (msg.app && msg.app !== state.mode) return;
          var myId = state.userId;
          if (msg.users[myId] && msg.users[myId].totalMl > state.totalMl) {
            state.totalMl = msg.users[myId].totalMl;
            state.count = msg.users[myId].count;
          }
          window.wsData = msg;
          renderLB();
        }
        if (msg.type === "nameTaken") {
          showToast("璇ユ樀绉板凡琚粬浜轰娇鐢紝璇锋崲涓€涓?);
          // Revert local name
          if (state.profile) {
            state.profile.name = (state.profile.name || "") + "_old";
            saveState();
          }
        }
                if (msg.type === "checkNameResult" && msg.available === false) {
          showToast("璇ユ樀绉板凡琚粬浜轰娇鐢紝璇锋崲涓€涓?);
        }
        if (msg.type === "dailyReset" && msg.app === state.mode) {
          var today = getToday();
          state.today = today;
          state.totalMl = 0;
          state.count = 0;
          state.logs = [];
          saveState();
          render();
          showToast("馃攧 鏂扮殑涓€澶╋紝鎺掕姒滃凡閲嶇疆");
        }
      } catch(e) {}
    };
    ws.onclose = function(){
      wsConnected = false;
      state.wsConnected = false;
      updateWSStatus();
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(connectWS, 5000);
    };
    ws.onerror = function(){};
  } catch(e) {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWS, 5000);
  }
}

function updateWSStatus(){
  var el = document.getElementById("wsCount");
  if (!el) return;
  el.textContent = wsConnected ? "馃煝 宸茶繛鎺? : "馃敶 鏈繛鎺?;
}

function showWorkoutPicker(){
  document.getElementById("btnStartWorkout").style.display="none";
  document.getElementById("workoutPicker").style.display="block";
}

function logWorkout(minutes){
  if (!minutes || minutes <= 0) return;
  if (state.mode !== "workout") return;
  state.workoutTotal += minutes;
  state.workoutSessions++;
  if (!state.workoutLogs) state.workoutLogs = [];
  state.workoutLogs.push({time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}),ml:minutes});
  var td=getToday();
  if (!state.workoutWeekData) state.workoutWeekData = {};
  state.workoutWeekData[td]=(state.workoutWeekData[td]||0)+minutes;
  state.workoutToday=td;
  // Show stats BEFORE render
  var _ws=document.getElementById("workoutStats");if(_ws)_ws.style.display="flex";
  var _wp=document.getElementById("workoutProgress");if(_wp)_wp.style.display="block";
  var _pk=document.getElementById("workoutPicker");if(_pk)_pk.style.display="none";
  var _bt=document.getElementById("btnStartWorkout");if(_bt)_bt.style.display="block";
  saveState();
  try{render()}catch(e){console.error('render:',e)}
  showToast("馃挭 +"+minutes+"鍒嗛挓");
  showMsg(randFrom(MSGS.workoutPraise));
  if (ws && ws.readyState === WebSocket.OPEN) {
    var p = state.profile || {};
    ws.send(JSON.stringify({type:"workout",userId:state.userId,name:p.name||"閿荤偧杈句汉",totalMin:state.workoutTotal,sessions:state.workoutSessions}));
  }
}

function sendDrinkUpdate(){
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  var p = state.profile || {};
  var drinkType = state.mode === "workout" ? "workout" : "drink";
  ws.send(JSON.stringify({type:drinkType,userId:state.userId,name:p.name||"鍖垮悕",totalMin:state.totalMl,sessions:state.count}));
}

const MSGS = {
  remind:[
    {e:"💧",t:"不喝水？想变成 <span class=hl>木乃伊</span>？"},
    {e:"💧",t:"<span class=hl>肾</span> 在哭泣……"},
    {e:"🥵",t:"再不喝水身体要 <span class=hl>回收水分</span> 了"},
    {e:"💧",t:"<span class=hl>脱水边缘</span>……喝杯水还能抢救"},
    {e:"💧",t:"离 <span class=hl>渴死</span> 还有多远？"},
    {e:"💧",t:"比 <span class=hl>仙人掌</span> 还耐旱？仙人掌也喝水！"},
    {e:"💧",t:"<span class=hl>棺材板</span> 在振动：喝……水……"},
    {e:"💧",t:"大脑：<span class=hl>-30%</span> 原因：缺水"},
    {e:"💧",t:"再不喝水 <span class=hl>灵魂</span> 要飘走"},
    {e:"💧",t:"喉咙在 <span class=hl>冒烟</span> 听到了吗？"},
    {e:"💧",t:"<span class=hl>喝了么？</span> 没喝？死亡倒计时又近了"},
    {e:"💧",t:"水都 <span class=hl>等急了</span>"},
    {e:"💧",t:"机体 <span class=hl>含水量不足</span>，进入休眠模式"},
    {e:"?",t:"<span class=hl>叮！</span> 喝水时间到！"},
  ],
  praise:[
    {e:"💧",t:"离 <span class=hl>健康活到老</span> 又近一步！"},
    {e:"💧",t:"超过 <span class=hl>99%</span> 的人！"},
    {e:"💧",t:"像条 <span class=hl>快乐的小鱼</span>"},
    {e:"💧",t:"<span class=hl>身体含水量</span> 恢复正常！"},
    {e:"💧",t:"<span class=hl>死亡倒计时</span> 又推迟了！"},
    {e:"💧",t:"大脑得到 <span class=hl>滋润</span>，智商+10"},
    {e:"?",t:"细胞们在 <span class=hl>欢呼</span>！"},
  ],
  goal:[{e:"💧",t:"<span class=hl>今日目标达成！</span> 没被渴死！"},{e:"💧",t:"<span class=hl>喝水之王！</span>"}],
  over:[{e:"💧",t:"别 <span class=hl>灌成水母</span>"},{e:"💧",t:"小心 <span class=hl>住厕所</span>"}]
};

let state = loadState();
let reminderTimer = null;
let snoozeUntil = null;
let audioCtx = null;

function calcGoal(g,a){a=parseInt(a)||25;if(a<6)return 1200;if(a<13)return g==="male"?1500:1300;if(a<18)return g==="male"?2200:1800;if(a<60)return g==="male"?2500:2000;return g==="male"?2200:1800}

function getDefaultState(){
  return{version:5,mode:"water",profile:null,userId:genId(),sound:"on",praiseMode:"on",remindMode:"smart",remindStart:"08:00",remindEnd:"22:00",wsConnected:false,today:getToday(),goal:2000,cupSize:200,totalMl:0,count:0,logs:[],weekData:{},workoutGoal:45,workoutSessionMin:15,workoutTotal:0,workoutSessions:0,workoutLogs:[],workoutWeekData:{}}
}
function genId(){return"hlm_"+Math.random().toString(36).substr(2,12)+Date.now().toString(36)}
function getToday(){return new Date().toISOString().slice(0,10)}

function loadState(){
  try{
    var r=localStorage.getItem(LS_KEY);
    if(r){
      var s=JSON.parse(r);var td=getToday();
      // Water daily reset
      if(s.today!==td){if(s.today)s.weekData[s.today]=(s.weekData[s.today]||0)+s.totalMl;s.today=td;s.totalMl=0;s.count=0;s.logs=[]}
      // Workout daily reset (separate)
      if(!s.workoutToday)s.workoutToday=td;
      if(s.workoutToday!==td){if(s.workoutToday)s.workoutWeekData[s.workoutToday]=(s.workoutWeekData[s.workoutToday]||0)+s.workoutTotal;s.workoutToday=td;s.workoutTotal=0;s.workoutSessions=0;s.workoutLogs=[]}
      if(!s.version){s.goal=2000;s.cupSize=200}
      if(s.version<5){s.workoutGoal=s.workoutGoal||45;s.workoutSessionMin=s.workoutSessionMin||15;s.workoutTotal=s.workoutTotal||0;s.workoutSessions=s.workoutSessions||0;s.workoutLogs=s.workoutLogs||[];  ,
  workoutRemind:[
    {e:"💪",t:"今天 <span class=hl>撸铁了吗</span>？再不练肌肉要跑了！"}
    {e:"💪",t:"你的 <span class=hl>肌肉</span> 在哭泣：快练我！"}
    {e:"💪",t:"看看 <span class=hl>镜子里的你</span>，确定不去练？"}
    {e:"💪",t:"隔壁老王都练了 <span class=hl>30分钟</span> 了！"}
    {e:"💪",t:"再不锻炼 <span class=hl>腹肌</span> 要消失了！"}
    {e:"💪",t:"举铁时间到！<span class=hl>动起来！</span>"}
    {e:"💪",t:"你离 <span class=hl>彭于曹</span> 只差一次训练！"}
    {e:"💪",t:"铁管都 <span class=hl>等急了</span>，快开撸！"}
    {e:"💪",t:"今天不撸铁，明天 <span class=hl>徒伤悲</span>"}
  ],
  workoutPraise:[
    {e:"💪",t:"好样的！<span class=hl>肌肉+1</span>！"}
    {e:"💪",t:"离 <span class=hl>施瓦辛格</span> 又近了一步！"}
    {e:"💪",t:"超过 <span class=hl>99%</span> 的懒人！"}
    {e:"💪",t:"每练一分钟，<span class=hl>强身健体</span>一辈子！"}
    {e:"💪",t:"乳酸素在 <span class=hl>飙升！</span>"}
    {e:"💪",t:"你的 <span class=hl>线条</span> 更明显了！"}
    {e:"💪",t:"汗水的味道就是 <span class=hl>男人的味道</span>！"}
    {e:"💪",t:"练完这一轮，<span class=hl>来瓶蛋白粉</span>！"}
  ],
  workoutGoal:[{e:"💪",t:"<span class=hl>今日训练目标达成！</span> 你是最棒的！"},{e:"💪",t:"<span class=hl>撸铁之王！</span>"}]
  workoutOver:[{e:"💪",t:"别 <span class=hl>练太猛</span>，小心肌肉拉伤"},{e:"💪",t:"休息一下，<span class=hl>别过度训练</span>"}]
  };let state = loadState();
let reminderTimer = null;
let snoozeUntil = null;
let audioCtx = null;

function calcGoal(g,a){a=parseInt(a)||25;if(a<6)return 1200;if(a<13)return g==="male"?1500:1300;if(a<18)return g==="male"?2200:1800;if(a<60)return g==="male"?2500:2000;return g==="male"?2200:1800}

function getDefaultState(){
  return{version:5,mode:"water",profile:null,userId:genId(),sound:"on",praiseMode:"on",remindMode:"smart",remindStart:"08:00",remindEnd:"22:00",wsConnected:false,today:getToday(),goal:2000,cupSize:200,totalMl:0,count:0,logs:[],weekData:{},workoutGoal:45,workoutSessionMin:15,workoutTotal:0,workoutSessions:0,workoutLogs:[],workoutWeekData:{}}
}
function genId(){return"hlm_"+Math.random().toString(36).substr(2,12)+Date.now().toString(36)}
function getToday(){return new Date().toISOString().slice(0,10)}

function loadState(){
  try{
    var r=localStorage.getItem(LS_KEY);
    if(r){
      var s=JSON.parse(r);var td=getToday();
      // Water daily reset
      if(s.today!==td){if(s.today)s.weekData[s.today]=(s.weekData[s.today]||0)+s.totalMl;s.today=td;s.totalMl=0;s.count=0;s.logs=[]}
      // Workout daily reset (separate)
      if(!s.workoutToday)s.workoutToday=td;
      if(s.workoutToday!==td){if(s.workoutToday)s.workoutWeekData[s.workoutToday]=(s.workoutWeekData[s.workoutToday]||0)+s.workoutTotal;s.workoutToday=td;s.workoutTotal=0;s.workoutSessions=0;s.workoutLogs=[]}
      if(!s.version){s.goal=2000;s.cupSize=200}
      if(s.version<5){s.workoutGoal=s.workoutGoal||45;s.workoutSessionMin=s.workoutSessionMin||15;s.workoutTotal=s.workoutTotal||0;s.workoutSessions=s.workoutSessions||0;s.workoutLogs=s.workoutLogs||[];  ,
  workoutRemind:[
    {e:"馃挭",t:"浠婂ぉ <span class=hl>鎾搁搧浜嗗悧</span>锛熷啀涓嶇粌鑲岃倝瑕佽窇浜嗭紒"}
    {e:"馃挭",t:"浣犵殑 <span class=hl>鑲岃倝</span> 鍦ㄥ摥娉ｏ細蹇粌鎴戯紒"}
    {e:"馃挭",t:"鐪嬬湅 <span class=hl>闀滃瓙閲岀殑浣?/span>锛岀‘瀹氫笉鍘荤粌锛?}
    {e:"馃挭",t:"闅斿鑰佺帇閮界粌浜?<span class=hl>30鍒嗛挓</span> 浜嗭紒"}
    {e:"馃挭",t:"鍐嶄笉閿荤偧 <span class=hl>鑵硅倢</span> 瑕佹秷澶变簡锛?}
    {e:"馃挭",t:"涓鹃搧鏃堕棿鍒帮紒<span class=hl>鍔ㄨ捣鏉ワ紒</span>"}
    {e:"馃挭",t:"浣犵 <span class=hl>褰簬鏇?/span> 鍙樊涓€娆¤缁冿紒"}
    {e:"馃挭",t:"閾佺閮?<span class=hl>绛夋€ヤ簡</span>锛屽揩寮€鎾革紒"}
    {e:"馃挭",t:"浠婂ぉ涓嶆捀閾侊紝鏄庡ぉ <span class=hl>寰掍激鎮?/span>"}
  ],
  workoutPraise:[
    {e:"馃挭",t:"濂芥牱鐨勶紒<span class=hl>鑲岃倝+1</span>锛?}
    {e:"馃挭",t:"绂?<span class=hl>鏂界摝杈涙牸</span> 鍙堣繎浜嗕竴姝ワ紒"}
    {e:"馃挭",t:"瓒呰繃 <span class=hl>99%</span> 鐨勬噿浜猴紒"}
    {e:"馃挭",t:"姣忕粌涓€鍒嗛挓锛?span class=hl>寮鸿韩鍋ヤ綋</span>涓€杈堝瓙锛?}
    {e:"馃挭",t:"涔抽吀绱犲湪 <span class=hl>椋欏崌锛?/span>"}
    {e:"馃挭",t:"浣犵殑 <span class=hl>绾挎潯</span> 鏇存槑鏄句簡锛?}
    {e:"馃挭",t:"姹楁按鐨勫懗閬撳氨鏄?<span class=hl>鐢蜂汉鐨勫懗閬?/span>锛?}
    {e:"馃挭",t:"缁冨畬杩欎竴杞紝<span class=hl>鏉ョ摱铔嬬櫧绮?/span>锛?}
  ],
  workoutGoal:[{e:"馃挭",t:"<span class=hl>浠婃棩璁粌鐩爣杈炬垚锛?/span> 浣犳槸鏈€妫掔殑锛?},{e:"馃挭",t:"<span class=hl>鎾搁搧涔嬬帇锛?/span>"}]
  workoutOver:[{e:"馃挭",t:"鍒?<span class=hl>缁冨お鐚?/span>锛屽皬蹇冭倢鑲夋媺浼?},{e:"馃挭",t:"浼戞伅涓€涓嬶紝<span class=hl>鍒繃搴﹁缁?/span>"}]
  };,{e:"馃挭",t:"?????<span class=hl>?????</span>"}]
};

let state = loadState();
let reminderTimer = null;
let snoozeUntil = null;
let audioCtx = null;

function calcGoal(g,a){a=parseInt(a)||25;if(a<6)return 1200;if(a<13)return g==="male"?1500:1300;if(a<18)return g==="male"?2200:1800;if(a<60)return g==="male"?2500:2000;return g==="male"?2200:1800}

function getDefaultState(){
  return{version:5,mode:"water",profile:null,userId:genId(),sound:"on",praiseMode:"on",remindMode:"smart",remindStart:"08:00",remindEnd:"22:00",wsConnected:false,today:getToday(),goal:2000,cupSize:200,totalMl:0,count:0,logs:[],weekData:{},workoutGoal:45,workoutSessionMin:15,workoutTotal:0,workoutSessions:0,workoutLogs:[],workoutWeekData:{}}
}
function genId(){return"hlm_"+Math.random().toString(36).substr(2,12)+Date.now().toString(36)}
function getToday(){return new Date().toISOString().slice(0,10)}

function loadState(){
  try{
    var r=localStorage.getItem(LS_KEY);
    if(r){
      var s=JSON.parse(r);var td=getToday();
      // Water daily reset
      if(s.today!==td){if(s.today)s.weekData[s.today]=(s.weekData[s.today]||0)+s.totalMl;s.today=td;s.totalMl=0;s.count=0;s.logs=[]}
      // Workout daily reset (separate)
      if(!s.workoutToday)s.workoutToday=td;
      if(s.workoutToday!==td){if(s.workoutToday)s.workoutWeekData[s.workoutToday]=(s.workoutWeekData[s.workoutToday]||0)+s.workoutTotal;s.workoutToday=td;s.workoutTotal=0;s.workoutSessions=0;s.workoutLogs=[]}
      if(!s.version){s.goal=2000;s.cupSize=200}
      if(s.version<5){s.workoutGoal=s.workoutGoal||45;s.workoutSessionMin=s.workoutSessionMin||15;s.workoutTotal=s.workoutTotal||0;s.workoutSessions=s.workoutSessions||0;s.workoutLogs=s.workoutLogs||[];s.workoutWeekData=s.workoutWeekData||{};s.workoutToday=s.workoutToday||td}
      if(!s.userId)s.userId=genId();if(!s.sound)s.sound="on";if(s.praiseMode===undefined)s.praiseMode="on"
      if(!s.remindMode)s.remindMode="smart";if(!s.remindStart)s.remindStart="08:00";if(!s.remindEnd)s.remindEnd="22:00"
      return s
    }
  }catch(e){}
  return getDefaultState()
}

function saveState(){try{localStorage.setItem(LS_KEY,JSON.stringify(state))}catch(e){}}

function playGulp(){
  if(state.sound==="off")return;
  try{
    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    var ctx=audioCtx,now=ctx.currentTime;
    for(var g=0;g<2;g++){
      var o=ctx.createOscillator(),gn=ctx.createGain(),t=now+g*0.12;
      o.type="sine";o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(150,t+0.12);
      gn.gain.setValueAtTime(0.3,t);gn.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      o.connect(gn);gn.connect(ctx.destination);o.start(t);o.stop(t+0.15)
    }
    var n=ctx.createOscillator(),ng=ctx.createGain();
    n.type="triangle";n.frequency.setValueAtTime(800,now+0.05);n.frequency.exponentialRampToValueAtTime(200,now+0.2);
    ng.gain.setValueAtTime(0.15,now+0.05);ng.gain.exponentialRampToValueAtTime(0.001,now+0.2);
    n.connect(ng);ng.connect(ctx.destination);n.start(now+0.05);n.stop(now+0.2)
  }catch(e){}
}

function drink(ml){
  if(!ml||ml<=0)return;
  if(state.mode==="workout")return;
  if(snoozeUntil&&Date.now()<snoozeUntil){showToast("? 鎻愰啋鏆傚仠涓?);return}
  state.totalMl+=ml;state.count++;
  state.logs.push({time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}),ml:ml});
  var td=getToday();state.weekData[td]=(state.weekData[td]||0)+ml;
  saveState();render();playGulp();sendDrinkUpdate();
  var r1=state.totalMl/state.goal;
  if(state.praiseMode==="on"){showMsg(randFrom(MSGS.praise))}else{if(r1>=1.2)showMsg(randFrom(MSGS.over));else if(r1>=1)showMsg(randFrom(MSGS.goal));else showMsg(randFrom(MSGS.praise))}
  showToast("馃挧 +"+ml+"ml")
}

function switchMode(mode){
  state.mode = mode;
  saveState();
  document.querySelectorAll(".mode-tab").forEach(function(t){t.classList.remove("active")});
  document.getElementById(mode === "water" ? "modeWater" : "modeWorkout").classList.add("active");
  document.querySelectorAll(".mode-water, .mode-workout").forEach(function(el){el.classList.toggle("active", el.classList.contains("mode-"+mode))});
  var t = document.getElementById("appTitle");
  var s = document.getElementById("appSubtitle");
  if (mode === "water") {
    t.textContent = "鍠濅簡涔?;
    s.innerHTML = "浠婂ぉ浣犲枬姘翠簡鍚楋紵馃挧";
    state.goal = state.goal || 2000;
  } else {
    t.textContent = "鎾镐簡涔?;
    s.innerHTML = "浠婂ぉ浣犳捀閾佷簡鍚楋紵馃挭";
    if (!state.workoutGoal) state.workoutGoal = 45;
    if (!state.workoutSessionMin) state.workoutSessionMin = 15;
  }
  // Workout mode: show workout UI, hide water stuff
  var ws = document.getElementById("waterStats");
  var wp = document.getElementById("waterProgress");
  var sb = document.getElementById("snoozeBar");
  var wb = document.getElementById("waterBtns");
  var hg = document.getElementById("historyBtn");
  var ht = document.getElementById("historyTab");
  var ct = document.getElementById("chartTab");
  if (mode === "workout") {
    var btn = document.getElementById("btnStartWorkout");
    var picker = document.getElementById("workoutPicker");
    var stats = document.getElementById("workoutStats");
    var prog = document.getElementById("workoutProgress");
    if (btn) btn.style.display = "block";
    if (picker) picker.style.display = "none";
    if (stats) stats.style.display = "flex";
    if (prog) prog.style.display = "block";
    if (ws) ws.style.display = "none";
    if (wp) wp.style.display = "none";
    if (sb) sb.style.display = "none";
    if (wb) wb.style.display = "none";
    if (hg) hg.style.display = "none";
    if (ht) ht.style.display = "none";
    if (ct) ct.style.display = "none";
    // Orange theme for workout tab
    var mt = document.getElementById("modeWorkout");
    if (mt) mt.style.cssText = "background:rgba(255,100,0,.15);color:#ff8c00;border-color:rgba(255,100,0,.3)";
    var mw = document.getElementById("modeWater");
    if (mw) mw.style.cssText = "";
  } else {
    if (ws) ws.style.display = "flex";
    if (wp) wp.style.display = "block";
    if (sb) sb.style.display = "";
    if (wb) wb.style.display = "";
    if (hg) hg.style.display = "";
    if (ht) ht.style.display = "";
    if (ct) ct.style.display = "";
    // Blue theme for water tab
    var mw = document.getElementById("modeWater");
    if (mw) mw.style.cssText = "background:rgba(0,150,255,.15);color:#4fc3f7;border-color:rgba(0,150,255,.3)";
    var mt = document.getElementById("modeWorkout");
    if (mt) mt.style.cssText = "";
  }
  render();
  // Re-send join with correct app
  if (ws && ws.readyState === WebSocket.OPEN) {
    var p = state.profile || {};
    ws.send(JSON.stringify({type:"join",app:mode,userId:state.userId,name:p.name||"鍖垮悕",totalMl:state.totalMl,count:state.count}));
  }
}

function render(){
  if (state.mode === "workout") { renderWorkout(); return; }
  renderWater();
}

function renderWater(){
  var t=state.totalMl,g=state.goal,r=Math.min(t/g,1);
  var totalEl = document.getElementById("todayTotal");
  if (totalEl) totalEl.textContent=t;
  var countEl = document.getElementById("todayCount");
  if (countEl) countEl.textContent=state.count;
  document.getElementById("goalDisplay").textContent=g;
  var fillEl = document.getElementById("waterFill");
  if (fillEl) fillEl.style.height=(r*100)+"%";
  document.getElementById("progressText").textContent=t+" / "+g+" ml";
  var fill=document.getElementById("progressFill");fill.style.width=Math.round(r*100)+"%";
  fill.classList.toggle("fire",t>0&&t<g*0.3);
  document.getElementById("progressLabel").textContent=t>=g?"鉁?浠婃棩杈炬爣":"馃搱 杩涘害";
  renderHistory();renderChart();renderLB();renderProfile();
}

function renderWorkout(){
  try{
    var t=state.workoutTotal||0,g=state.workoutGoal||45;
    var _wt=document.getElementById("workoutTotal");if(_wt)_wt.textContent=Math.round(t*10)/10;
    var _ws=document.getElementById("workoutSessions");if(_ws)_ws.textContent=state.workoutSessions||0;
    var fillEl = document.getElementById("gymFill");
    if (fillEl) fillEl.style.height=(g>0?Math.min(Math.round(t/g*100),100):0)+"%";
    // gymLabel removed - stag SVG shows in workout mode
    var _pf=document.getElementById("workoutProgressFill");if(_pf)_pf.style.width=(g>0?Math.min(Math.round(t/g*100),100):0)+"%";
    var _pt=document.getElementById("workoutProgressText");if(_pt)_pt.textContent=Math.round(t*10)/10+" / "+g+" 鍒嗛挓";
    renderLB();
  }catch(e){console.error('renderWorkout:',e)}
}
function renderHistory(){
  var el=document.getElementById("historyList");
  if(!state.logs.length){el.innerHTML="<div class=history-empty>杩樻病鏈夊枬姘磋褰?/div>";return}
  el.innerHTML=state.logs.slice().reverse().map(function(l){
    var e=l.ml>=500?"馃嵑":(l.ml>=300?"馃イ":"馃挧");
    return"<div class=history-item><span class=hi-time>"+l.time+"</span><span>"+e+"</span><span class=hi-amount>+"+l.ml+"ml</span></div>"
  }).join("")
}

function renderChart(){
  var el=document.getElementById("weekChart"),td=new Date(),ds=[];
  for(var i=6;i>=0;i--){var d=new Date(td);d.setDate(d.getDate()-i);ds.push(d.toISOString().slice(0,10))}
  var mx=Math.max.apply(null,ds.map(function(d){return state.weekData[d]||0}));if(mx<1)mx=1;
  var ts=getToday();
  el.innerHTML=ds.map(function(d){
    var ml=state.weekData[d]||0,h=Math.max((ml/mx)*90,3),lb=new Date(d).toLocaleDateString("zh-CN",{weekday:"short"});
    return"<div class=wk-wrap><div class=wk-bar"+(d===ts?" today":"")+" style=height:"+h+"px></div><div class=wk-val>"+(ml>0?ml:"")+"</div><div class=wk-label>"+lb+"</div></div>"
  }).join("")
}

function renderProfile(){
  var p=state.profile;
  if(!p){document.getElementById("profileEmoji").textContent="馃懁";document.getElementById("profileName").textContent="鏈缃?;return}
  document.getElementById("profileEmoji").textContent=p.gender==="male"?"馃懆":"馃挧";
  document.getElementById("profileName").textContent=p.name||(p.gender==="male"?"鐢峰＋":"濂冲＋")
}

function renderLB(){
  var el=document.getElementById("leaderboardList"),items=[];
  var myId = state.userId;
  var myName = state.profile ? state.profile.name : "鎴?;
  var myMl = state.mode === "workout" ? (state.workoutTotal||0) : state.totalMl;
  var myCount = state.mode === "workout" ? (state.workoutSessions||0) : state.count;
  if (window.wsData && window.wsData.users) {
    var sv = window.wsData.users;
    if (sv[myId]) {
      myMl = Math.max(myMl, sv[myId].totalMl || 0);
      myCount = Math.max(myCount, sv[myId].count || 0);
      myName = sv[myId].name || myName;
    }
  }
  items.push({id:myId,name:myName,totalMl:myMl,count:myCount,isMe:true});
  if (window.wsData && window.wsData.users) {
    Object.keys(window.wsData.users).forEach(function(uid){
      if (uid !== myId) {
        var u = window.wsData.users[uid];
        items.push({id:uid,name:u.name||"鍖垮悕",totalMl:u.totalMl||0,count:u.count||0,isMe:false});
      }
    });
  }
  items.sort(function(a,b){return b.totalMl-a.totalMl});
  var alone = items.length === 1 && !window.wsConnected;
  if (items.length === 0 || alone) {
    el.innerHTML="<div class=lb-empty><div style=font-size:2rem;margin-bottom:8px>馃搳</div><div>绛夊緟鍏朵粬浜哄姞鍏モ€︹€?/div><div style=font-size:.75rem;color:rgba(160,200,255,.4);margin-top:4px>杩炴帴鏈嶅姟鍣ㄥ嵆鍙湅鍒版墍鏈夌敤鎴?/div></div>";
    return
  }
  el.innerHTML=items.map(function(e,i){
    var medal = i===0 ? "馃" : (i===1 ? "馃" : (i===2 ? "馃" : ""));
    var maxMl = items[0].totalMl || 1;
    var pct = Math.min(Math.round(e.totalMl/maxMl*100), 100);
    var rankClass = i===0 ? "gold" : (i===1 ? "silver" : (i===2 ? "bronze" : "normal"));
    var s = "<div class=lb-item" + (e.isMe ? " me" : "") + ">";
    s += "<div class=\"lb-rank \" + rankClass + \"\">" + (medal || (i + 1)) + "</div>";
    s += "<div class=lb-info>";
    s += "<div class=lb-name>" + e.name + (e.isMe ? " <span class=lb-you>浣?/span>" : "") + "</div>";
    s += "<div class=lb-count>" + (state.mode === "workout" ? "💪 " + e.count + "次" : "💧 " + e.count + "杯") + "</div>";
    s += "<div class=lb-bar><div class=lb-bar-fill style=width:" + pct + "%></div></div>";
    s += "</div>";
    s += "<div class=lb-stat>";
    s += "<div class=lb-stat>";
    s += "<div class=num>" + e.totalMl + "</div>";
    s += "<div class=lbl>" + (state.mode === "workout" ? "min" : "ml") + "</div>";
    s += "</div>";
    s += "</div>";
    return s;
  }).join("");
  var c = window.wsConnected && window.wsData && window.wsData.users ? Object.keys(window.wsData.users).length : 0;
  el.innerHTML += "<div class=lb-status>馃煝 " + c + " 浜哄湪绾?/div>";
}
function switchTab(name,btn){
  document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});
  document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("active")});
  btn.classList.add("active");document.getElementById("panel"+name.charAt(0).toUpperCase()+name.slice(1)).classList.add("active")
}

function showMsg(msg){if(!msg)return;document.getElementById("msgAvatar").textContent=msg.e;document.getElementById("msgText").innerHTML=msg.t}
function randFrom(arr){return arr[Math.floor(Math.random()*arr.length)]}

function saveOnboard(){
  var g=document.getElementById("onboardGender").value,a=parseInt(document.getElementById("onboardAge").value)||25,n=document.getElementById("onboardName").value.trim()||(g==="male"?"姘村弸鈾?:"姘村弸鈾€");
  state.profile={name:n,gender:g,age:a};
  state.goal=calcGoal(g,a);
  state.workoutGoal=g==="male"?60:45;
  saveState();render();
  document.getElementById("onboardOverlay").classList.remove("active");
  showToast("鉁?"+n+"锛屽枬姘寸洰鏍囷細"+state.goal+"ml 閿荤偧鐩爣锛?+state.workoutGoal+"鍒嗛挓");startReminder()
}

document.addEventListener("DOMContentLoaded",function(){
  if(!state.profile){
    function uc(){var g=document.getElementById("onboardGender").value,a=parseInt(document.getElementById("onboardAge").value)||25;document.getElementById("onboardGoal").textContent=calcGoal(g,a)}
    document.getElementById("onboardGender").addEventListener("change",uc);
    document.getElementById("onboardAge").addEventListener("input",uc);uc();
    document.getElementById("onboardOverlay").classList.add("active")
  }
})

function calcSmartInterval(){
  if(state.remindMode==="off")return 0;
  var now=new Date(),hour=now.getHours(),min=now.getMinutes();
  var sp=(state.remindStart||"08:00").split(":").map(Number),ep=(state.remindEnd||"22:00").split(":").map(Number);
  var sm=sp[0]*60+sp[1],em=ep[0]*60+ep[1],cm=hour*60+min;
  if(cm<sm||cm>em)return 0;
  if(state.remindMode==="fixed")return 30*60*1000;
  var ratio=state.totalMl/Math.max(state.goal,1);
  if(ratio>=1)return 0;
  var dp=(cm-sm)/Math.max(em-sm,1),bi;
  if(dp<0.25)bi=20;else if(dp<0.5)bi=30;else if(dp<0.75)bi=35;else bi=45;
  if(ratio<0.3)bi=Math.floor(bi*0.6);else if(ratio<0.5)bi=Math.floor(bi*0.8);
  return Math.max(bi*60*1000,10*60*1000)
}

function startReminder(){stopReminder();if(state.remindMode!=="off")scheduleNext()}
function stopReminder(){if(reminderTimer){clearTimeout(reminderTimer);reminderTimer=null}}

function scheduleNext(){
  var interval=calcSmartInterval();
  if(interval<=0)return;
  reminderTimer=setTimeout(function(){
    if(snoozeUntil&&Date.now()<snoozeUntil){scheduleNext();return}
    if(state.totalMl<state.goal&&state.profile){
      var msg=randFrom(state.mode==="workout"?MSGS.workoutRemind:MSGS.remind);showMsg(msg);
      var pt=msg.t.replace(/<[^>]*>/g,"");
      showToast(msg.e+" "+pt);
      if("Notification"in window&&Notification.permission==="granted")new Notification("鍠濅簡涔?,{body:pt});
      if(navigator.vibrate)navigator.vibrate([100,50,100]);
      document.getElementById("snoozeBar").classList.add("show");startSnoozeCD()
    }
    scheduleNext()
  },interval)
}

function snooze(){snoozeUntil=Date.now()+15*60*1000;document.getElementById("snoozeBar").classList.add("show");startSnoozeCD();showToast("? 鏆傚仠15鍒嗛挓")}
function cancelSnooze(){snoozeUntil=null;document.getElementById("snoozeBar").classList.remove("show");showToast("鉁?鎭㈠")}

var snoozeTimer=null;
function startSnoozeCD(){
  if(snoozeTimer)clearInterval(snoozeTimer);
  snoozeTimer=setInterval(function(){
    if(!snoozeUntil||Date.now()>=snoozeUntil){document.getElementById("snoozeBar").classList.remove("show");clearInterval(snoozeTimer);return}
    document.getElementById("snoozeCountdown").textContent=Math.round((snoozeUntil-Date.now())/1000/60)+"鍒嗛挓鍚庢仮澶?
  },1000)
}

var toastTimer=null;
function showToast(msg){
  var el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove("show")},2500)
}

function openModal(mode){
  if(mode==="settings"){
    document.getElementById("goalInput").value=state.goal;document.getElementById("cupInput").value=state.cupSize;
    document.getElementById("workoutGoalInput").value=state.workoutGoal||45;
    document.getElementById("sessionInput").value=state.workoutSessionMin||15;
    document.getElementById("soundToggle").value=state.sound||"on";document.getElementById("praiseToggle").value=state.praiseMode||"on";document.getElementById("reminderMode").value=state.remindMode||"smart";
    document.getElementById("remindStart").value=state.remindStart||"08:00";document.getElementById("remindEnd").value=state.remindEnd||"22:00";
    document.getElementById("modalTitle").textContent="鈿欙笍 璁剧疆";document.getElementById("modalOverlay").classList.add("active")
  }else if(mode==="custom"){
    document.getElementById("customAmount").value=state.mode==="workout"?state.workoutSessionMin:state.cupSize;document.getElementById("customModalOverlay").classList.add("active");
    setTimeout(function(){document.getElementById("customAmount").focus()},100)
  }else if(mode==="profile"){
    var p=state.profile||{};document.getElementById("profileNameInput").value=p.name||"";
    document.getElementById("profileGenderInput").value=p.gender||"male";document.getElementById("profileAgeInput").value=p.age||25;
    document.getElementById("profileModalOverlay").classList.add("active")
  }
}

function closeModal(){document.getElementById("modalOverlay").classList.remove("active")}
function closeCustomModal(){document.getElementById("customModalOverlay").classList.remove("active")}
function closeProfileModal(){document.getElementById("profileModalOverlay").classList.remove("active")}



function saveSettings(){
  state.goal=Math.max(100,Math.min(10000,parseInt(document.getElementById("goalInput").value)||2000));
  var sizeVal = parseInt(document.getElementById("cupInput").value)||200;
  state.cupSize=Math.max(50,Math.min(2000,sizeVal));
  state.workoutSessionMin=Math.max(5,Math.min(120,parseInt(document.getElementById("sessionInput").value)||15));
  state.workoutGoal=Math.max(10,Math.min(300,parseInt(document.getElementById("workoutGoalInput").value)||45));
  state.sound=document.getElementById("soundToggle").value;state.praiseMode=document.getElementById("praiseToggle").value;state.remindMode=document.getElementById("reminderMode").value;
  state.remindStart=document.getElementById("remindStart").value||"08:00";state.remindEnd=document.getElementById("remindEnd").value||"22:00";
  saveState();render();startReminder();closeModal();showToast("? 淇濆瓨")
}

function saveProfile(){
  var n=document.getElementById("profileNameInput").value.trim()||"姘村弸",g=document.getElementById("profileGenderInput").value,a=parseInt(document.getElementById("profileAgeInput").value)||25;
  state.profile={name:n,gender:g,age:a};
  state.goal=calcGoal(g,a);
  state.workoutGoal=g==="male"?60:45;
  saveState();render();closeProfileModal();showToast("? 鍠濇按锛?+state.goal+"ml 閿荤偧锛?+state.workoutGoal+"鍒嗛挓")
}

function confirmCustomDrink(){var v=parseInt(document.getElementById("customAmount").value)||0;if(v<=0){showToast("? 鏃犳晥鏁伴噺");return}closeCustomModal();drink(v)}

function shareApp(){
  var p = state.profile || {};
  var name = p.name || "鏈嬪弸";
  var preview = document.getElementById("sharePreview");
  if (preview) {
    var shareTitle = state.mode === "workout" ? "馃挭 鎾镐簡涔?- 浠婂ぉ浣犳捀閾佷簡鍚楋紵" : "馃挧 鍠濅簡涔?- 浠婂ぉ浣犲枬姘翠簡鍚楋紵";
  var shareAction = state.mode === "workout" ? "閭€浣犱竴璧锋捀閾? : "閭€浣犱竴璧峰枬姘?;
  var shareLB = state.mode === "workout" ? "鐐瑰紑鐪嬬湅鎾搁搧姒? : "鐐瑰紑鐪嬬湅鎺掕姒?;
  preview.innerHTML = shareTitle + "<br><span style=font-size:.7rem;color:rgba(100,200,255,.4)>" + name + " " + shareAction + "鈻? + shareLB + "</span>";;
  }
  document.getElementById("shareModalOverlay").classList.add("active")
}

function copyShareLink(){
    var msg = (state.mode === "workout" ? "💪 撸了么 - 今天你撸铁了吗？\n点开看看撸铁榜：" : "💧 喝了么 - 今天你喝水了吗？\n点开看看排行榜：") + APP_URL;
  navigator.clipboard.writeText(msg).then(function(){showToast("馃摛 宸插鍒讹紝鍙戠粰鏈嬪弸鍚э紒")}).catch(function(){showToast(APP_URL)})
}

function closeShareModal(){document.getElementById("shareModalOverlay").classList.remove("active")}

function clearToday(){
  if(!state.logs.length)return;if(!confirm("纭畾娓呯┖锛?))return;
  var td=getToday();state.totalMl=0;state.count=0;state.logs=[];state.weekData[td]=0;
  saveState();render();showToast("馃棏锔?宸叉竻绌?);showMsg(randFrom(MSGS.remind))
}

function resetToday(){
  if(state.totalMl===0&&state.count===0){showToast("浠婂ぉ杩樻病鍠濇按");return}
  if(!confirm("纭畾閲嶇疆锛?))return;
  state.totalMl=0;state.count=0;state.logs=[];saveState();render();showToast("馃攧 宸查噸缃?);showMsg(randFrom(MSGS.remind))
}

document.addEventListener("keydown",function(e){if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT")return;if(e.key===" "||e.key==="Spacebar"){e.preventDefault();drink(state.cupSize)}});

["modalOverlay","customModalOverlay","profileModalOverlay"].forEach(function(id){
  document.getElementById(id).addEventListener("click",function(e){
    if(e.target===this){
      var map={modalOverlay:closeModal,customModalOverlay:closeCustomModal,profileModalOverlay:closeProfileModal};
      map[id]()
    }
  })
});

function init(){
  if("Notification"in window&&Notification.permission==="default")Notification.requestPermission();
  var bg=document.getElementById("waterBg");
  for(var i=0;i<15;i++){var b=document.createElement("div");b.className="bubble";var s=10+Math.random()*30;b.style.width=s+"px";b.style.height=s+"px";b.style.left=Math.random()*100+"%";b.style.animationDuration=(8+Math.random()*12)+"s";b.style.animationDelay=(Math.random()*10)+"s";bg.appendChild(b)}
  connectWS();
  state.mode = "water"; switchMode("water");
  if(!state.profile){showMsg({e:"馃挧",t:"瀹屾垚寮曞璁剧疆寮€濮嬪枬姘?<span class=hl>鈽濓笍</span>"})}else{setTimeout(function(){if(state.totalMl<state.goal)showMsg(randFrom(MSGS.remind))},1500);startReminder()}
}

init();
