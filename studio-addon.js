/* DreamWall publishing/reload compatibility fix. */
(async()=>{
  const OLD_ADDON='https://raw.githubusercontent.com/Penelopethinks/WallDream/90825771a6d7af59f0fcd003637e39f8d3f3f808/studio-addon.js';
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=OLD_ADDON;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  }).catch(e=>console.error('DreamWall studio addon could not load:',e));

  const getProfiles=async rows=>{
    const ids=[...new Set(rows.map(w=>w.user_id).filter(Boolean))];
    if(!ids.length)return new Map();
    const r=await sb.from('profiles').select('id,username,real_name,avatar_url,bio').in('id',ids);
    if(r.error){console.error('DreamWall profile load error:',r.error);return new Map();}
    return new Map((r.data||[]).map(p=>[p.id,p]));
  };

  window.loadWallpapers=async function(){
    const r=await sb.from('wallpapers').select('*').order('created_at',{ascending:false}).limit(100);
    if(r.error){console.error('DreamWall wallpaper load error:',r.error);wallpapers=[];return false;}
    const rows=r.data||[];
    const profileMap=await getProfiles(rows);
    wallpapers=rows.map(w=>({...w,profiles:profileMap.get(w.user_id)||null}));
    return true;
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
    await loadLikeCounts();
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
          user_id:user.id,title:'',subtitle:'',caption,
          background:state.background||'#fff',text_color:'#111111',font:'Arial',
          title_size:52,subtitle_size:16,decorations,brightness:100,contrast:100,blur:0
        }).select('*').single();
        if(result.error)throw result.error;
        const savedId=result.data?.id;
        const ok=await window.loadWallpapers();
        if(!ok)throw new Error('The wallpaper was saved, but the app could not refresh its wallpaper list.');
        if(savedId && !wallpapers.some(w=>w.id===savedId))throw new Error('The wallpaper was saved, but could not be found after refreshing.');
        $('postCaption').value='';
        await loadLikeCounts();
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
