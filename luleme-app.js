const APP_URL = location.href;
const WS_URL = "wss://heleme-server-qjum-production.up.railway.app";
const LS_KEY = "luleme_v1";

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
      ws.send(JSON.stringify({type:"join",app:"workout",userId:state.userId,name:p.name||"撸铁达人",totalMl:state.totalMl,count:state.count}));
      updateWSStatus();
    };
    ws.onmessage = function(e){
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === "leaderboard" && msg.app === "workout" && msg.users) {
          var myId = state.userId;
          if (msg.users[myId] && msg.users[myId].totalMl > state.totalMl) {
            state.totalMl = msg.users[myId].totalMl;
            state.count = msg.users[myId].count;
          }
          window.wsData = msg;
          renderLB();
        }
        if (msg.type === "nameTaken") {
          showToast("该昵称已被他人使用，请换一个");
          // Revert local name
          if (state.profile) {
            state.profile.name = (state.profile.name || "") + "_old";
            saveState();
          }
        }
                if (msg.type === "checkNameResult" && msg.available === false) {
          showToast("该昵称已被他人使用，请换一个");
        }
        if (msg.type === "dailyReset" && msg.app === "workout") {
          var today = getToday();
          state.today = today;
          state.totalMl = 0;
          state.count = 0;
          state.logs = [];
          saveState();
          render();
          showToast("🔄 新的一天，排行榜已重置");
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
  el.textContent = wsConnected ? "🟢 已连接" : "🔴 未连接";
}

function sendDrinkUpdate(){
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  var p = state.profile || {};
  ws.send(JSON.stringify({type:"workout",userId:state.userId,name:p.name||"撸铁达人",totalMin:state.totalMl,sessions:state.count}));
}

const MSGS = {
  remind:[
    {e:"💪",t:"不撸铁？想变成 <span class=hl>豆腐腿</span>？"},
    {e:"💪",t:"<span class=hl>肌肉</span> 在哭泣……"},
    {e:"🔥",t:"再不撸铁身体要 <span class=hl>回收肌肉</span> 了"},
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

function calcGoal(g,a){a=parseInt(a)||25;if(a<13)return 20;if(a<18)return g==="male"?45:35;if(a<60)return g==="male"?60:45;return g==="male"?45:30}

function getDefaultState(){
  return{version:1,goal:45,sessionMin:15,sound:"on",praiseMode:"on",remindMode:"smart",remindStart:"08:00",remindEnd:"22:00",today:getToday(),totalMl:0,count:0,logs:[],weekData:{},profile:null,userId:genId(),wsConnected:false}
}
function genId(){return"hlm_"+Math.random().toString(36).substr(2,12)+Date.now().toString(36)}
function getToday(){return new Date().toISOString().slice(0,10)}

function loadState(){
  try{
    var r=localStorage.getItem(LS_KEY);
    if(r){
      var s=JSON.parse(r);var td=getToday();
      if(s.today!==td){if(s.today)s.weekData[s.today]=(s.weekData[s.today]||0)+s.totalMl;s.today=td;s.totalMl=0;s.count=0;s.logs=[]}
      if(!s.version){s.goal=2000;s.cupSize=200}
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

function drink(分钟){
  if(!分钟||分钟<=0)return;
  if(snoozeUntil&&Date.now()<snoozeUntil){showToast("? 提醒暂停中");return}
  state.totalMl+=ml;state.count++;
  state.logs.push({time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}),分钟:分钟});
  var td=getToday();state.weekData[td]=(state.weekData[td]||0)+分钟;
  saveState();render();playGulp();sendDrinkUpdate();
  var r1=state.totalMl/state.goal;
  if(state.praiseMode==="on"){showMsg(randFrom(MSGS.praise))}else{if(r1>=1.2)showMsg(randFrom(MSGS.over));else if(r1>=1)showMsg(randFrom(MSGS.goal));else showMsg(randFrom(MSGS.praise))}
  showToast("💧 +"+分钟+"分钟")
}

function render(){
  var t=state.totalMl,g=state.goal,r=Math.min(t/g,1);
  document.getElementById("todayTotal").textContent=t;
  document.getElementById("todayCount").textContent=state.count;
  document.getElementById("goalDisplay").textContent=g;
  document.getElementById("waterFill").style.height=(r*100)+"%";
  document.getElementById("progressText").textContent=t+" / "+g+" 分钟";
  var fill=document.getElementById("progressFill");fill.style.width=Math.round(r*100)+"%";
  fill.classList.toggle("fire",t>0&&t<g*0.3);
  document.getElementById("progressLabel").textContent=t>=g?"✅ 今日达标":"📈 进度";
  renderHistory();renderChart();renderLB();renderProfile();
  
}

function renderHistory(){
  var el=document.getElementById("historyList");
  if(!state.logs.length){el.innerHTML="<div class=history-empty>还没有训练记录</div>";return}
  el.innerHTML=state.logs.slice().reverse().map(function(l){
    var e=l.分钟>=500?"🍺":(l.分钟>=300?"🥤":"💧");
    return"<div class=history-item><span class=hi-time>"+l.time+"</span><span>"+e+"</span><span class=hi-amount>+"+l.分钟+"分钟</span></div>"
  }).join("")
}

function renderChart(){
  var el=document.getElementById("weekChart"),td=new Date(),ds=[];
  for(var i=6;i>=0;i--){var d=new Date(td);d.setDate(d.getDate()-i);ds.push(d.toISOString().slice(0,10))}
  var mx=Math.max.apply(null,ds.map(function(d){return state.weekData[d]||0}));if(mx<1)mx=1;
  var ts=getToday();
  el.innerHTML=ds.map(function(d){
    var 分钟=state.weekData[d]||0,h=Math.max((分钟/mx)*90,3),lb=new Date(d).toLocaleDateString("zh-CN",{weekday:"short"});
    return"<div class=wk-wrap><div class=wk-bar"+(d===ts?" today":"")+" style=height:"+h+"px></div><div class=wk-val>"+(分钟>0?分钟:"")+"</div><div class=wk-label>"+lb+"</div></div>"
  }).join("")
}

function renderProfile(){
  var p=state.profile;
  if(!p){document.getElementById("profileEmoji").textContent="👤";document.getElementById("profileName").textContent="未设置";return}
  document.getElementById("profileEmoji").textContent=p.gender==="male"?"👨":"💧";
  document.getElementById("profileName").textContent=p.name||(p.gender==="male"?"男士":"女士")
}

function renderLB(){
  var el=document.getElementById("leaderboardList"),items=[];
  var myId = state.userId;
  var myName = state.profile ? state.profile.name : "我";
  var myMl = state.totalMl;
  var myCount = state.count;
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
        items.push({id:uid,name:u.name||"匿名",totalMl:u.totalMl||0,count:u.count||0,isMe:false});
      }
    });
  }
  items.sort(function(a,b){return b.totalMl-a.totalMl});
  var alone = items.length === 1 && !window.wsConnected;
  if (items.length === 0 || alone) {
    el.innerHTML="<div class=lb-empty><div style=font-size:2rem;margin-bottom:8px>📊</div><div>等待其他人加入……</div><div style=font-size:.75rem;color:rgba(160,200,255,.4);margin-top:4px>连接服务器即可看到所有用户</div></div>";
    return
  }
  el.innerHTML=items.map(function(e,i){
    var medal = i===0 ? "🥇" : (i===1 ? "🥈" : (i===2 ? "🥉" : ""));
    var maxMl = items[0].totalMl || 1;
    var pct = Math.min(Math.round(e.totalMl/maxMl*100), 100);
    var rankClass = i===0 ? "gold" : (i===1 ? "silver" : (i===2 ? "bronze" : "normal"));
    var s = "<div class=lb-item" + (e.isMe ? " me" : "") + ">";
    s += "<div class=\"lb-rank \" + rankClass + \"\">" + (medal || (i + 1)) + "</div>";
    s += "<div class=lb-info>";
    s += "<div class=lb-name>" + e.name + (e.isMe ? " <span class=lb-you>你</span>" : "") + "</div>";
    s += "<div class=lb-count>💧 " + e.count + "杯</div>";
    s += "<div class=lb-bar><div class=lb-bar-fill style=width:" + pct + "%></div></div>";
    s += "</div>";
    s += "<div class=lb-stat>";
    s += "<div class=num>" + e.totalMl + "</div>";
    s += "<div class=lbl>分钟</div>";
    s += "</div>";
    s += "</div>";
    return s;
  }).join("");
  var c = window.wsConnected && window.wsData && window.wsData.users ? Object.keys(window.wsData.users).length : 0;
  el.innerHTML += "<div class=lb-status>🟢 " + c + " 人在线</div>";
}
function switchTab(name,btn){
  document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});
  document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("active")});
  btn.classList.add("active");document.getElementById("panel"+name.charAt(0).toUpperCase()+name.slice(1)).classList.add("active")
}

function showMsg(msg){if(!msg)return;document.getElementById("msgAvatar").textContent=msg.e;document.getElementById("msgText").innerHTML=msg.t}
function randFrom(arr){return arr[Math.floor(Math.random()*arr.length)]}

function saveOnboard(){
  var g=document.getElementById("onboardGender").value,a=parseInt(document.getElementById("onboardAge").value)||25,n=document.getElementById("onboardName").value.trim()||(g==="male"?"水友♂":"水友♀");
  var gl=calcGoal(g,a);state.profile={name:n,gender:g,age:a};state.goal=gl;saveState();render();
  document.getElementById("onboardOverlay").classList.remove("active");
  showToast("✅ "+n+"，今日训练目标："+gl+"分钟");startReminder()
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
      var msg=randFrom(MSGS.remind);showMsg(msg);
      var pt=msg.t.replace(/<[^>]*>/g,"");
      showToast(msg.e+" "+pt);
      if("Notification"in window&&Notification.permission==="granted")new Notification("喝了么",{body:pt});
      if(navigator.vibrate)navigator.vibrate([100,50,100]);
      document.getElementById("snoozeBar").classList.add("show");startSnoozeCD()
    }
    scheduleNext()
  },interval)
}

function snooze(){snoozeUntil=Date.now()+15*60*1000;document.getElementById("snoozeBar").classList.add("show");startSnoozeCD();showToast("? 暂停15分钟")}
function cancelSnooze(){snoozeUntil=null;document.getElementById("snoozeBar").classList.remove("show");showToast("✅ 恢复")}

var snoozeTimer=null;
function startSnoozeCD(){
  if(snoozeTimer)clearInterval(snoozeTimer);
  snoozeTimer=setInterval(function(){
    if(!snoozeUntil||Date.now()>=snoozeUntil){document.getElementById("snoozeBar").classList.remove("show");clearInterval(snoozeTimer);return}
    document.getElementById("snoozeCountdown").textContent=Math.round((snoozeUntil-Date.now())/1000/60)+"分钟后恢复"
  },1000)
}

var toastTimer=null;
function showToast(msg){
  var el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove("show")},2500)
}

function openModal(mode){
  if(mode==="settings"){
    document.getElementById("goalInput").value=state.goal;document.getElementById("sessionInput").value=state.sessionMin;
    document.getElementById("soundToggle").value=state.sound||"on";document.getElementById("praiseToggle").value=state.praiseMode||"on";document.getElementById("reminderMode").value=state.remindMode||"smart";
    document.getElementById("remindStart").value=state.remindStart||"08:00";document.getElementById("remindEnd").value=state.remindEnd||"22:00";
    document.getElementById("modalTitle").textContent="⚙️ 设置";document.getElementById("modalOverlay").classList.add("active")
  }else if(mode==="custom"){
    document.getElementById("customAmount").value=state.sessionMin;document.getElementById("customModalOverlay").classList.add("active");
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
  state.sessionMin=Math.max(50,Math.min(2000,parseInt(document.getElementById("sessionInput").value)||200));
  state.sound=document.getElementById("soundToggle").value;state.praiseMode=document.getElementById("praiseToggle").value;state.remindMode=document.getElementById("reminderMode").value;
  state.remindStart=document.getElementById("remindStart").value||"08:00";state.remindEnd=document.getElementById("remindEnd").value||"22:00";
  saveState();render();startReminder();closeModal();showToast("? 保存")
}

function saveProfile(){
  var n=document.getElementById("profileNameInput").value.trim()||"水友",g=document.getElementById("profileGenderInput").value,a=parseInt(document.getElementById("profileAgeInput").value)||25;
  var gl=calcGoal(g,a);state.profile={name:n,gender:g,age:a};state.goal=gl;saveState();render();closeProfileModal();showToast("? 今日训练目标："+gl+"分钟")
}

function confirmCustomDrink(){var 分钟=parseInt(document.getElementById("customAmount").value)||0;if(分钟<=0){showToast("? 无效数量");return}closeCustomModal();drink(分钟)}

function shareApp(){
  var p = state.profile || {};
  var name = p.name || "朋友";
  var preview = document.getElementById("sharePreview");
  if (preview) {
    preview.innerHTML = "💪 撸了么 - 今天你撸铁了吗？<br><span style=font-size:.7rem;color:rgba(100,200,255,.4)>" + name + " 邀你一起撸铁▗点开看看撸铁榜</span>";
  }
  document.getElementById("shareModalOverlay").classList.add("active")
}

function copyShareLink(){
  var msg = "💪 撸了么 - 今天你撸铁了吗？\n点开看看撸铁榜：" + APP_URL;
  navigator.clipboard.writeText(msg).then(function(){showToast("📤 已复制，发给朋友吧！")}).catch(function(){showToast(APP_URL)})
}

function closeShareModal(){document.getElementById("shareModalOverlay").classList.remove("active")}

function clearToday(){
  if(!state.logs.length)return;if(!confirm("确定清空？"))return;
  var td=getToday();state.totalMl=0;state.count=0;state.logs=[];state.weekData[td]=0;
  saveState();render();showToast("🗑️ 已清空");showMsg(randFrom(MSGS.remind))
}

function resetToday(){
  if(state.totalMl===0&&state.count===0){showToast("今天还没训练");return}
  if(!confirm("确定重置？"))return;
  state.totalMl=0;state.count=0;state.logs=[];saveState();render();showToast("🔄 已重置");showMsg(randFrom(MSGS.remind))
}

document.addEventListener("keydown",function(e){if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT")return;if(e.key===" "||e.key==="Spacebar"){e.preventDefault();drink(state.sessionMin)}});

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
  render();
  if(!state.profile){showMsg({e:"💧",t:"完成引导设置开始撸铁 <span class=hl>☝️</span>"})}else{setTimeout(function(){if(state.totalMl<state.goal)showMsg(randFrom(MSGS.remind))},1500);startReminder()}
}

init();
