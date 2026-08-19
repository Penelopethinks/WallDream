/* DreamWall publishing + wallpaper display fix. */
(async()=>{
  const URL="https://kcybwrdtnlflevndmzfn.supabase.co";
  const KEY="sb_publishable_XhOq8P5tdMgjWDKZEvgsgg_hcALWg48";
  const api=window.supabase.createClient(URL,KEY);
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  async function currentUser(){
    const r=await api.auth.getSession();
    return r.data?.session?.user||null;
  }

  function parseDecorations(value){
    if(Array.isArray(value))return value;
    if(typeof value!=="string")return [];
    try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return []}
  }

  function renderWallpaperInto(el,w){
    if(!el||!w)return;
    el.innerHTML="";
    el.style.position="relative";
    el.style.overflow="hidden";
    el.style.width="100%";
    el.style.height="100%";
    el.style.background=w.background||"#fff";
    el.style.backgroundImage="none";
    el.style.backgroundSize="";
    el.style.filter=`brightness(${w.brightness??100}%) contrast(${w.contrast??100}%) blur(${w.blur??0}px)`;
    parseDecorations(w.decorations).forEach(d=>{
      const o=document.createElement("div");
      o.className="wallObj";
      o.textContent=d?.text??"";
      if(d?.css)o.style.cssText=d.css;
      if(!o.style.position)o.style.position="absolute";
      o.style.pointerEvents="none";
      el.appendChild(o);
    });
  }

  async function loadWallpapersFixed(){
    const r=await api.from("wallpapers").select("*").order("created_at",{ascending:false}).limit(100);
    if(r.error){console.error("DreamWall wallpaper load error:",r.error);return false}
    const rows=r.data||[];
    const ids=[...new Set(rows.map(w=>w.user_id).filter(Boolean))];
    let profiles=[];
    if(ids.length){
      const p=await api.from("profiles").select("id,username,real_name,avatar_url,bio").in("id",ids);
      if(p.error)console.error("DreamWall profile load error:",p.error);else profiles=p.data||[];
    }
    const byId=new Map(profiles.map(p=>[String(p.id),p]));
    wallpapers=rows.map(w=>({...w,profiles:byId.get(String(w.user_id))||null}));
    return true;
  }

  async function loadLikesFixed(){
    const r=await api.from("likes").select("wallpaper_id,user_id");
    if(r.error){console.error("DreamWall likes load error:",r.error);return}
    const counts={},mine={};
    const u=await currentUser();
    (r.data||[]).forEach(x=>{counts[x.wallpaper_id]=(counts[x.wallpaper_id]||0)+1;if(u&&String(x.user_id)===String(u.id))mine[x.wallpaper_id]=true});
    (wallpapers||[]).forEach(w=>{w.likes_count=counts[w.id]||0;w.liked=!!mine[w.id]});
  }

  function viewer(){
    if($("dwWallpaperViewer"))return;
    const modal=document.createElement("div");
    modal.id="dwWallpaperViewer";
    modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.84);display:none;place-items:center;z-index:9999;padding:20px";
    modal.innerHTML=`<div style="position:relative;width:min(430px,92vw);height:min(90vh,760px);background:#111;border-radius:18px;padding:12px;display:flex;align-items:center;justify-content:center"><button id="dwViewerClose" style="position:absolute;right:8px;top:8px;width:38px;height:38px;border:0;border-radius:50%;background:#fff;color:#111;font-size:24px;z-index:2">×</button><div id="dwViewerWall" style="height:100%;width:100%;border-radius:10px;overflow:hidden;position:relative"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click",e=>{if(e.target===modal)modal.style.display="none"});
    $("dwViewerClose").onclick=()=>modal.style.display="none";
  }

  function showWallpaper(w){viewer();renderWallpaperInto($("dwViewerWall"),w);$("dwWallpaperViewer").style.display="grid"}

  function renderWallElements(){
    const byId=new Map((wallpapers||[]).map(w=>[String(w.id),w]));
    document.querySelectorAll("[data-dw-wallpaper-id]").forEach(el=>{const w=byId.get(String(el.dataset.dwWallpaperId));if(w){renderWallpaperInto(el,w);el.onclick=()=>showWallpaper(w)}});
  }

  function buildHome(){
    const feed=$("homeFeed");if(!feed)return;
    feed.innerHTML=(wallpapers||[]).map(w=>{
      const p=w.profiles||{};const name=p.real_name||p.username||"DreamWall creator";const handle=p.username?"@"+p.username:"@creator";
      return `<article class="post"><div class="posthead" style="cursor:default"><div class="avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}">`:esc(name.charAt(0).toUpperCase())}</div><div><div class="postname">${esc(name)}</div><div class="handle">${esc(handle)}</div><div class="post-time">${typeof timeAgo==="function"?timeAgo(new Date(w.created_at)):""}</div></div></div><div class="wall" data-dw-wallpaper-id="${esc(w.id)}"></div><div class="actions"><button class="iconbtn" onclick="window.dwLike('${esc(w.id)}')">♡</button><button class="iconbtn" onclick="window.dwOpen('${esc(w.id)}')">🔍</button><button class="iconbtn save">🔖</button></div><div class="likes">${Number(w.likes_count||0)} likes</div><div class="caption">${esc(w.caption||"")}</div></article>`;
    }).join("")||`<div class="notice"><b>No wallpapers yet.</b><br><br>Create the first one! ✨</div>`;
    renderWallElements();
  }

  function buildGrid(id,onlyMine=false){
    const box=$(id);if(!box)return;
    const rows=(wallpapers||[]).filter(w=>!onlyMine||String(w.user_id)===String(window.__dwCurrentUserId||""));
    box.innerHTML=rows.map(w=>`<div class="tile" data-dw-wallpaper-id="${esc(w.id)}"></div>`).join("")||`<div class="notice" style="grid-column:1/-1">No wallpapers yet.</div>`;
    renderWallElements();
  }

  function installPeopleViewer(){
    if($("dwPeopleViewer"))return;
    const modal=document.createElement("div");modal.id="dwPeopleViewer";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.86);display:none;place-items:center;z-index:9998;padding:20px";
    modal.innerHTML=`<div style="width:min(760px,96vw);max-height:92vh;overflow:auto;background:var(--card,#fff);color:var(--text,#171717);border-radius:18px;padding:22px;position:relative"><button id="dwPeopleClose" style="position:absolute;right:12px;top:10px;border:0;background:transparent;color:inherit;font-size:28px">×</button><h2 id="dwPeopleTitle" style="margin:0 0 4px"></h2><div id="dwPeopleSub" class="muted">Wallpapers from the last 24 hours</div><div id="dwPeopleGrid" class="recent-grid"></div></div>`;
    document.body.appendChild(modal);modal.addEventListener("click",e=>{if(e.target===modal)modal.style.display="none"});$("dwPeopleClose").onclick=()=>modal.style.display="none";
  }

  function openRecentWallpapers(id){
    installPeopleViewer();const p=(people||[]).find(x=>String(x.id)===String(id));if(!p)return;
    const recent=(wallpapers||[]).filter(w=>String(w.user_id)===String(id)&&Date.now()-new Date(w.created_at).getTime()<86400000);
    $("dwPeopleTitle").textContent=p.real_name||p.username||"DreamWaller";$("dwPeopleSub").textContent=`@${p.username||"username"} • ${recent.length} wallpaper${recent.length===1?"":"s"} in the last 24 hours`;
    $("dwPeopleGrid").innerHTML=recent.map(w=>`<div class="recent-tile" data-dw-wallpaper-id="${esc(w.id)}"></div>`).join("")||`<div class="notice" style="grid-column:1/-1">No wallpapers posted in the last 24 hours.</div>`;
    renderWallElements();$("dwPeopleViewer").style.display="grid";
  }

  function renderPeopleFixed(){
    const row=$("peopleRow");if(!row)return;
    row.innerHTML=(people||[]).map(p=>`<div class="person" data-dw-person-id="${esc(p.id)}"><div class="person-avatar"><div class="person-inner">${p.avatar_url?`<img src="${esc(p.avatar_url)}">`:esc((p.real_name||p.username||"P").charAt(0).toUpperCase())}</div></div><div class="person-name">${esc(p.real_name||p.username||"DreamWaller")}</div></div>`).join("")||`<div class="muted">No other DreamWallers yet.</div>`;
    row.querySelectorAll("[data-dw-person-id]").forEach(el=>el.onclick=()=>openRecentWallpapers(el.dataset.dwPersonId));
  }

  window.dwOpen=id=>{const w=(wallpapers||[]).find(x=>String(x.id)===String(id));if(w)showWallpaper(w)};
  window.dwLike=async id=>{
    const u=await currentUser();if(!u){$("authModal")?.classList.add("open");return}
    const existing=await api.from("likes").select("wallpaper_id").eq("wallpaper_id",id).eq("user_id",u.id).maybeSingle();
    if(existing.data)await api.from("likes").delete().eq("wallpaper_id",id).eq("user_id",u.id);else await api.from("likes").insert({wallpaper_id:id,user_id:u.id});
    await loadLikesFixed();buildHome();buildGrid("exploreGrid");buildGrid("profileGrid",true);
  };

  async function refresh(){
    const u=await currentUser();if(!u)return;
    window.__dwCurrentUserId=u.id;
    const ok=await loadWallpapersFixed();if(!ok)return;
    await loadLikesFixed();renderPeopleFixed();buildHome();buildGrid("exploreGrid");buildGrid("profileGrid",true);
  }

  const publish=$("publish");
  if(publish)publish.onclick=async()=>{
    const u=await currentUser();
    if(!u){$("authModal")?.classList.add("open");return}
    window.__dwCurrentUserId=u.id;
    const old=publish.textContent;publish.disabled=true;publish.textContent="Publishing...";
    try{
      const state=editorState();
      const decorations=(state.objects||[]).map(o=>({text:o.text||"",css:o.css||"",type:o.type||"decoration"}));
      const payload={user_id:u.id,title:"",subtitle:"",caption:$("postCaption").value.trim(),background:state.background||"#fff",text_color:"#111111",font:"Arial",title_size:52,subtitle_size:16,decorations,brightness:100,contrast:100,blur:0};
      const result=await api.from("wallpapers").insert(payload).select("id,created_at").single();
      if(result.error)throw result.error;
      if(!result.data?.id)throw new Error("Wallpaper was saved but no ID was returned.");
      const loaded=await refresh();
      if(!loaded)throw new Error("The wallpaper was saved, but DreamWall could not refresh the feed.");
      if(!(wallpapers||[]).some(w=>String(w.id)===String(result.data.id)))throw new Error("The wallpaper was saved, but it could not be loaded back into DreamWall.");
      $("postCaption").value="";
      if(typeof goPage==="function")goPage("home");
      alert("Wallpaper published! 🎉");
    }catch(error){console.error("DreamWall publish error:",error);alert("Could not publish:\n\n"+(error?.message||"Please try again."));}
    finally{publish.disabled=false;publish.textContent=old}
  };

  installPeopleViewer();viewer();
  setTimeout(refresh,300);setTimeout(refresh,1500);setTimeout(refresh,3000);
  if(typeof sb!=="undefined")sb.auth.onAuthStateChange(()=>setTimeout(refresh,150));
  window.__dreamwallFixedRefresh=refresh;
})();
