/* DreamWall publishing/reload compatibility fix. */
(async()=>{
  /* Do not load the old studio addon here. It uses the old local-storage
     publisher and can also trigger the old Supabase relationship queries. */

  const getProfiles=async rows=>{
    const ids=[...new Set(rows.map(w=>w.user_id).filter(Boolean))];
    if(!ids.length)return new Map();
    const r=await sb.from('profiles').select('id,username,real_name,avatar_url,bio').in('id',ids);
    if(r.error){console.error('DreamWall profile load error:',r.error);return new Map();}
    return new Map((r.data||[]).map(p=>[p.id,p]));
  };

  window.loadWallpapers=async function(){
    /* Important: fetch wallpapers and profiles separately. Never ask
       PostgREST to embed profiles because this project has ambiguous
       wallpaper/profile relationships in its schema cache. */
    const r=await sb.from('wallpapers').select('*').order('created_at',{ascending:false}).limit(100);
    if(r.error){console.error('DreamWall wallpaper load error:',r.error);wallpapers=[];return false;}
    const rows=r.data||[];
    const profileMap=await getProfiles(rows);
    wallpapers=rows.map(w=>({...w,profiles:profileMap.get(w.user_id)||null}));
    return true;
  };

  window.loadLikeCounts=async function(){
    try{
      const r=await sb.from('likes').select('wallpaper_id,user_id');
      if(r.error){console.error('DreamWall likes load error:',r.error);return;}
      const counts=new Map();
      const liked=new Set();
      (r.data||[]).forEach(x=>{
        counts.set(x.wallpaper_id,(counts.get(x.wallpaper_id)||0)+1);
        if(user && x.user_id===user.id)liked.add(x.wallpaper_id);
      });
      (wallpapers||[]).forEach(w=>{
        w.likes=counts.get(w.id)||0;
        w.likes_count=w.likes;
        w.liked=user?liked.has(w.id):false;
      });
    }catch(e){console.error('DreamWall likes compatibility error:',e)}
  };

  window.loadApp=async function(){
    const session=await sb.auth.getSession();
    user=session.data.session?.user||null;
    if(!user){
      $('authModal').classList.add('open');
      return;
    }
    $('authModal').classList.remove('open');
    await ensureProfile();
    await loadPeople();
    await window.loadWallpapers();
    await window.loadLikeCounts();
    renderEverything();
    goPage('home');
  };

  const publishButton=$('publish');
  if(publishButton){
    publishButton.onclick=async()=>{
      if(!user){$('authModal').classList.add('open');return;}
      const oldText=publishButton.textContent;
      publishButton.disabled=true;
      publishButton.textContent='Publishing...';
      try{
        const state=editorState();
        const decorations=state.objects.map(o=>({text:o.text,css:o.css,type:o.type}));
        const caption=$('postCaption').value.trim();
        const result=await sb.from('wallpapers').insert({
          user_id:user.id,
          title:'',
          subtitle:'',
          caption,
          background:state.background||'#fff',
          text_color:'#111111',
          font:'Arial',
          title_size:52,
          subtitle_size:16,
          decorations,
          brightness:100,
          contrast:100,
          blur:0
        }).select('*').single();
        if(result.error)throw result.error;
        const savedId=result.data?.id;
        const ok=await window.loadWallpapers();
        if(!ok)throw new Error('The wallpaper was saved, but the app could not refresh its wallpaper list.');
        if(savedId && !wallpapers.some(w=>w.id===savedId))throw new Error('The wallpaper was saved, but could not be found after refreshing.');
        await window.loadLikeCounts();
        $('postCaption').value='';
        renderEverything();
        goPage('home');
        alert('Wallpaper published! 🎉');
      }catch(error){
        console.error('DreamWall publish error:',error);
        alert('Could not publish:\n\n'+(error?.message||'Please try again.'));
      }finally{
        publishButton.disabled=false;
        publishButton.textContent=oldText;
      }
    };
  }

  if(window.loadApp)await window.loadApp();
})();
