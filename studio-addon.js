/* DreamWall publishing + wallpaper rendering fix. */
(async()=>{
  const FIXED_URL="https://kcybwrdtnlflevndmzfn.supabase.co";
  const FIXED_KEY="sb_publishable_XhOq8P5tdMgjWDKZEvgsgg_hcALWg48";
  const api=window.supabase.createClient(FIXED_URL,FIXED_KEY);

  async function fixedLoadWallpapers(){
    const r=await api.from("wallpapers").select("*").order("created_at",{ascending:false}).limit(100);
    if(r.error){console.error("DreamWall wallpaper load error:",r.error);return false;}
    const rows=r.data||[];
    const ids=[...new Set(rows.map(w=>w.user_id).filter(Boolean))];
    let profiles=[];
    if(ids.length){
      const p=await api.from("profiles").select("id,username,real_name,avatar_url,bio,display_name").in("id",ids);
      if(!p.error)profiles=p.data||[];
    }
    const byId=new Map(profiles.map(p=>[String(p.id),p]));
    wallpapers=rows.map(w=>({...w,profiles:byId.get(String(w.user_id))||null}));
    return true;
  }

  async function fixedLoadLikes(){
    const r=await api.from("likes").select("wallpaper_id,user_id");
    if(r.error)return;
    const counts={},mine={};
    (r.data||[]).forEach(x=>{counts[x.wallpaper_id]=(counts[x.wallpaper_id]||0)+1;if(user&&String(x.user_id)===String(user.id))mine[x.wallpaper_id]=true;});
    (wallpapers||[]).forEach(w=>{w.likes_count=counts[w.id]||0;w.likes=w.likes_count;w.liked=!!mine[w.id];});
  }

  function safe(s){return String(s??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));}

  function renderWallpaperInto(el,w){
    if(!el||!w)return;
    el.innerHTML="";
    el.style.position="relative";
    el.style.overflow="hidden";
    el.style.width="100%";
    el.style.height="100%";
    el.style.background=w.background||"#fff";
    el.style.backgroundImage="none";
    el.style.filter="none";
    let decorations=w.decorations;
    if(typeof decorations==="string"){try{decorations=JSON.parse(decorations)}catch{decorations=[]}}
    (Array.isArray(decorations)?decorations:[]).forEach(d=>{
      const o=document.createElement("div");
      o.textContent=d.text||"";
      o.style.cssText=d.css||"";
      o.style.position=o.style.position||"absolute";
      el.appendChild(o);
    });
  }

  function installViewer(){
    if(document.getElementById("dwWallpaperViewer"))return;
    const modal=document.createElement("div");
    modal.id="dwWallpaperViewer";
    modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);display:none;place-items:center;z-index:9999;padding:20px";
    modal.innerHTML='<div style="position:relative;width:min(430px,92vw);height:min(90vh,760px);background:#111;border-radius:18px;padding:12px;display:flex;align-items:center;justify-content:center"><button id="dwViewerClose" style="position:absolute;right:8px;top:8px;width:38px;height:38px;border:0;border-radius:50%;background:#fff;color:#111;font-size:24px;z-index:2">×</button><div id="dwViewerWall" style="height:100%;width:100%;border-radius:10px;overflow:hidden;position:relative"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click",e=>{if(e.target===modal)modal.style.display="none"});
    document.getElementById("dwViewerClose").onclick=()=>modal.style.display="none";
  }

  function showWallpaper(w){
    installViewer();
    renderWallpaperInto(document.getElementById("dwViewerWall"),w);
    document.getElementById("dwWallpaperViewer").style.display="grid";
  }

  function renderRealWallpapers(){
    const byId=new Map((wallpapers||[]).map(w=>[String(w.id),w]));
    document.querySelectorAll("[data-dw-wallpaper-id]").forEach(el=>{
      const w=byId.get(String(el.dataset.dwWallpaperId));
      if(w){renderWallpaperInto(el,w);el.onclick=()=>showWallpaper(w);}
    });
  }

  function buildHome(){
    const feed=$("homeFeed");
    if(!feed)return;
    feed.innerHTML=(wallpapers||[]).map(w=>{
      const p=w.profiles||{};
      const name=p.display_name||p.real_name||p.username||"DreamWall creator";
      const handle=p.username?"@"+p.username:"@creator";
      return `<article class="post"><div class="posthead"><div class="avatar">${p.avatar_url?`<img src="${safe(p.avatar_url)}">`:safe(name.slice(0,1).toUpperCase())}</div><div><div class="postname">${safe(name)}</div><div class="handle">${safe(handle)}</div></div></div><div class="wall" data-dw-wallpaper-id="${safe(w.id)}"></div><div class="actions"><button class="iconbtn" onclick="window.dwLike('${safe(w.id)}')">♡</button><button class="iconbtn" onclick="window.dwOpen('${safe(w.id)}')">🔍</button><button class="iconbtn save">🔖</button></div><div class="likes">${Number(w.likes_count||0)} likes</div><div class="caption">${safe(w.caption||"")}</div></article>`;
    }).join("")||'<div class="notice">No wallpapers yet. Create the first one! ✨</div>';
    renderRealWallpapers();
  }

  function buildGrid(id,onlyMine=false){
    const box=$(id);if(!box)return;
    const rows=(wallpapers||[]).filter(w=>!onlyMine||String(w.user_id)===String(user?.id));
    box.innerHTML=rows.map(w=>`<div class="tile" data-dw-wallpaper-id="${safe(w.id)}"></div>`).join("")||'<div class="notice" style="grid-column:1/-1">No wallpapers yet.</div>';
    renderRealWallpapers();
  }

  window.dwOpen=id=>{const w=(wallpapers||[]).find(x=>String(x.id)===String(id));if(w)showWallpaper(w);};
  window.dwLike=async id=>{if(!user)return;const w=(wallpapers||[]).find(x=>String(x.id)===String(id));if(!w)return;const r=await api.from("likes").insert({wallpaper_id:id,user_id:user.id});if(r.error&&r.error.code!=="23505")console.error(r.error);await fixedLoadLikes();buildHome();buildGrid("exploreGrid");buildGrid("profileGrid",true);};

  function renderRealEverything(){
    buildHome();
    buildGrid("exploreGrid");
    buildGrid("profileGrid",true);
  }

  async function refreshFixed(){
    if(!user)return;
    if(await fixedLoadWallpapers()){
      await fixedLoadLikes();
      if(typeof renderEverything==="function")renderEverything();
      renderRealEverything();
    }
  }

  const publishButton=$("publish");
  if(publishButton)publishButton.onclick=async()=>{
    if(!user){$("authModal").classList.add("open");return;}
    const old=publishButton.textContent;publishButton.disabled=true;publishButton.textContent="Publishing...";
    try{
      const state=editorState();
      let decorations=(state.objects||[]).map(o=>({text:o.text,css:o.css,type:o.type}));
      const result=await api.from("wallpapers").insert({user_id:user.id,title:"",subtitle:"",caption:$("postCaption").value.trim(),background:state.background||"#fff",text_color:"#111111",font:"Arial",title_size:52,subtitle_size:16,decorations,brightness:100,contrast:100,blur:0}).select("id").single();
      if(result.error)throw result.error;
      const id=result.data?.id;if(!id)throw new Error("Wallpaper saved without an ID.");
      if(!await fixedLoadWallpapers())throw new Error("Wallpaper saved, but could not reload it.");
      if(!wallpapers.some(w=>String(w.id)===String(id)))throw new Error("Wallpaper saved, but could not be found.");
      await fixedLoadLikes();
      $("postCaption").value="";
      renderRealEverything();
      if(typeof goPage==="function")goPage("home");
      alert("Wallpaper published! 🎉");
    }catch(e){console.error(e);alert("Could not publish:\n\n"+(e?.message||"Please try again."));}
    finally{publishButton.disabled=false;publishButton.textContent=old;}
  };

  installViewer();
  window.__dreamwallFixedRefresh=refreshFixed;
  setTimeout(refreshFixed,700);
  setTimeout(refreshFixed,2200);
})();
