/* DreamWall publishing fix v3.
   This file intentionally does NOT embed profiles through PostgREST.
   The project has an ambiguous relationship in its schema cache, so
   wallpapers and profiles are always fetched separately. */
(async()=>{
  const FIXED_URL="https://kcybwrdtnlflevndmzfn.supabase.co";
  const FIXED_KEY="sb_publishable_XhOq8P5tdMgjWDKZEvgsgg_hcALWg48";
  const api=window.supabase.createClient(FIXED_URL,FIXED_KEY);

  async function fixedLoadWallpapers(){
    const r=await api.from("wallpapers")
      .select("*")
      .order("created_at",{ascending:false})
      .limit(100);
    if(r.error){
      console.error("DreamWall wallpaper load error:",r.error);
      return false;
    }

    const rows=r.data||[];
    const ids=[...new Set(rows.map(w=>w.user_id).filter(Boolean))];
    let profiles=[];
    if(ids.length){
      const p=await api.from("profiles")
        .select("id,username,real_name,avatar_url,bio")
        .in("id",ids);
      if(p.error){
        console.error("DreamWall profile load error:",p.error);
      }else{
        profiles=p.data||[];
      }
    }
    const byId=new Map(profiles.map(p=>[String(p.id),p]));
    wallpapers=rows.map(w=>({...w,profiles:byId.get(String(w.user_id))||null}));
    return true;
  }

  async function fixedLoadLikes(){
    const r=await api.from("likes").select("wallpaper_id,user_id");
    if(r.error){console.error("DreamWall likes load error:",r.error);return;}
    const counts={};
    const mine={};
    (r.data||[]).forEach(x=>{
      counts[x.wallpaper_id]=(counts[x.wallpaper_id]||0)+1;
      if(user && String(x.user_id)===String(user.id)) mine[x.wallpaper_id]=true;
    });
    (wallpapers||[]).forEach(w=>{
      w.likes_count=counts[w.id]||0;
      w.likes=w.likes_count;
      w.liked=!!mine[w.id];
    });
  }

  async function refreshFixed(){
    if(!user)return;
    const ok=await fixedLoadWallpapers();
    if(!ok)return;
    await fixedLoadLikes();
    if(typeof renderEverything==="function")renderEverything();
  }

  const publishButton=$("publish");
  if(publishButton){
    publishButton.onclick=async()=>{
      if(!user){$("authModal").classList.add("open");return;}
      const oldText=publishButton.textContent;
      publishButton.disabled=true;
      publishButton.textContent="Publishing...";
      try{
        const state=editorState();
        const decorations=(state.objects||[]).map(o=>({
          text:o.text,
          css:o.css,
          type:o.type
        }));
        const caption=$("postCaption").value.trim();

        /* IMPORTANT: no .select() and no profiles embed here. */
        const inserted=await api.from("wallpapers").insert({
          user_id:user.id,
          title:"",
          subtitle:"",
          caption,
          background:state.background||"#fff",
          text_color:"#111111",
          font:"Arial",
          title_size:52,
          subtitle_size:16,
          decorations,
          brightness:100,
          contrast:100,
          blur:0
        }).select("id").single();

        if(inserted.error)throw inserted.error;
        const newId=inserted.data?.id;
        if(!newId)throw new Error("Supabase saved the wallpaper but did not return its ID.");

        const ok=await fixedLoadWallpapers();
        if(!ok)throw new Error("The wallpaper was saved, but DreamWall could not reload the wallpaper list.");
        if(!wallpapers.some(w=>String(w.id)===String(newId))){
          throw new Error("The wallpaper was saved, but DreamWall could not find it after publishing.");
        }

        await fixedLoadLikes();
        $("postCaption").value="";
        if(typeof renderEverything==="function")renderEverything();
        if(typeof goPage==="function")goPage("home");
        alert("Wallpaper published! 🎉");
      }catch(error){
        console.error("DreamWall publish error:",error);
        alert("Could not publish:\n\n"+(error?.message||"Please try again."));
      }finally{
        publishButton.disabled=false;
        publishButton.textContent=oldText;
      }
    };
  }

  /* The original index.html has an older loader. Run the safe loader after
     it so a normal page refresh cannot replace the wallpaper list with an
     empty result from the ambiguous relationship query. */
  window.__dreamwallFixedRefresh=refreshFixed;
  setTimeout(refreshFixed,800);
  setTimeout(refreshFixed,2500);

  api.auth.onAuthStateChange(()=>{
    setTimeout(refreshFixed,300);
  });
})();
