/* DreamWall cleanup + local multi-account addon. This keeps the original app intact. */
(function(){
  const KEY='dreamwallAccounts';
  function accounts(){return JSON.parse(localStorage.getItem(KEY)||'[]')}
  function saveAccounts(a){localStorage.setItem(KEY,JSON.stringify(a))}
  function syncCurrent(){
    let a=accounts(), u=db.account.username;
    if(u){let i=a.findIndex(x=>x.username.toLowerCase()===u.toLowerCase()); if(i<0){a.push(JSON.parse(JSON.stringify(db.account)));saveAccounts(a)}}
  }
  syncCurrent();
  window.saveCurrentAccountToPeople=function(){
    let a=accounts(), u=db.account.username;
    if(!u)return;
    let i=a.findIndex(x=>x.username.toLowerCase()===u.toLowerCase());
    if(i<0)a.push(JSON.parse(JSON.stringify(db.account))); else a[i]=JSON.parse(JSON.stringify(db.account));
    saveAccounts(a);
  };
  window.deleteWallpaper=function(id){
    const p=db.posts.find(x=>x.id===id); if(!p)return;
    if(p.creator!==db.account.username){toast('You can only delete your own wallpapers.');return}
    if(!confirm('Delete this wallpaper? This cannot be undone.'))return;
    db.posts=db.posts.filter(x=>x.id!==id);save();showHome();toast('Wallpaper deleted.');
  };
  window.showPeople=function(){
    syncCurrent();
    const a=accounts();
    openModal('<div class="modal-header"><h2>People on this device</h2><button class="close" onclick="closeModal()">×</button></div>'+
      '<p style="color:var(--muted);line-height:1.5">These are DreamWall accounts saved in this browser. HTML by itself cannot show accounts from another phone or computer; that requires a real online database.</p>'+
      '<div>'+a.map(x=>'<div class="person" style="display:flex;align-items:center;gap:12px;margin:8px 0;background:#faf7fc"><img class="avatar" src="'+(x.avatar||placeholder)+'"><div style="flex:1"><strong>@'+esc(x.username)+'</strong><small style="display:block;color:var(--muted)">'+esc(x.realName||'')+'</small></div><button class="secondary" onclick="switchPerson(\''+js(x.username)+'\')">Switch</button></div>').join('')+'</div>'+
      '<hr style="border:0;border-top:1px solid var(--border);margin:18px 0"><button class="primary" onclick="newLocalPerson()">＋ Add another person</button>');
  };
  window.switchPerson=function(username){
    syncCurrent();
    const a=accounts(), found=a.find(x=>x.username.toLowerCase()===username.toLowerCase());
    if(!found)return;
    db.account=JSON.parse(JSON.stringify(found)); save(); theme(); closeModal(); showHome(); toast('Switched to @'+found.username);
  };
  window.newLocalPerson=function(){closeModal();editAccount();setTimeout(()=>toast('Save this new profile and it will appear in People.'),100)};
  window.showMyWallpapers=function(){
    const mine=db.posts.filter(p=>p.creator===db.account.username);
    openModal('<div class="modal-header"><h2>My Wallpapers</h2><button class="close" onclick="closeModal()">×</button></div><p style="color:var(--muted)">Only your own wallpapers can be deleted.</p>'+ (mine.length?mine.map(p=>'<div class="card" style="padding:12px"><div style="display:flex;gap:10px;align-items:center"><div style="flex:1"><strong>'+esc(p.title)+'</strong><div class="small">'+esc(p.caption||'')+'</div></div><button class="secondary" onclick="deleteWallpaper('+p.id+');showMyWallpapers()">Delete</button></div></div>').join(''):'<div class="empty"><div class="empty-icon">🎨</div><h3>No wallpapers yet</h3></div>');
  };
  const oldShowProfile=window.showProfile;
  window.showProfile=function(){oldShowProfile(); setTimeout(()=>{
    const page=document.querySelector('.profile-page'); if(!page)return;
    const buttons=page.querySelector('.profile-buttons'); if(buttons){
      const b=document.createElement('button'); b.className='secondary'; b.textContent='🗑 Manage Wallpapers'; b.onclick=showMyWallpapers; buttons.appendChild(b);
      const p=document.createElement('button'); p.className='secondary'; p.textContent='👥 People'; p.onclick=showPeople; buttons.appendChild(p);
    }
  },0)};
  const oldRenderPost=window.renderPost;
  window.renderPost=function(p){
    let html=oldRenderPost(p);
    if(p.creator===db.account.username){
      html=html.replace('<button class="post-menu">•••</button>','<button class="post-menu" onclick="deleteWallpaper('+p.id+')">🗑</button>');
    }
    return html;
  };
  const oldEdit=window.editAccount;
  window.editAccount=function(){oldEdit();setTimeout(()=>{
    const modal=document.getElementById('modal');
    if(!modal)return;
    const saveBtn=modal.querySelector('.primary');
    if(saveBtn){const old=saveBtn.getAttribute('onclick');saveBtn.setAttribute('onclick',old+';saveCurrentAccountToPeople()')}
    const note=document.createElement('div');note.className='ai-info';note.innerHTML='👥 <strong>Multiple people:</strong> Save different profiles in this browser, then use Profile → People to switch between them. For true accounts shared across phones, DreamWall will need an online database.';modal.appendChild(note);
  },0)};
})();
