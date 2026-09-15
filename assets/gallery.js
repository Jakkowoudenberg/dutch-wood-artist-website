  (function(){
    'use strict';
    var gallery=document.getElementById('gallery'),chapters=Array.from(gallery.querySelectorAll('.chapter'));
    var reader=document.getElementById('reader'),readerScroll=document.getElementById('reader-scroll'),readerContent=document.getElementById('reader-content');
    var indexDialog=document.getElementById('index-dialog'),archive=document.getElementById('original-stories').content;
    var current=0,currentStory=null,readerPushed=false,skipCloseHistory=false,opener=null,scrollTimer,programmaticUntil=0;
    var positions=new Map(),reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    var titles={book:'A book in the making',manifesto:'Manifesto',why:'Why',inssaei:'INSSAEI',nightwatch:'The Night Watch in Wood',artist:'The artist',commissions:'Commissions',uwfl:'United Wood Floor Layers',gemikigai:'Gemikigai', 'between-doors':'Between Doors',contact:'Get in touch','inssaei-photos':'INSSAEI · Photographs'};
    var tabs={manifesto:'Manifesto',why:'Why',artist:'The Artist',commissions:'Commissions',uwfl:'UWFL project',gemikigai:'Gemikigai','between-doors':'Between Doors',contact:'Contact'};
    var storyPathsNode=document.getElementById('story-paths'),storyPaths=storyPathsNode?JSON.parse(storyPathsNode.textContent):{};
    var storyNodes={};
    Object.keys(tabs).forEach(function(key){var source=archive.querySelector('[data-tab="'+tabs[key]+'"] .col');storyNodes[key]=source?Array.from(source.childNodes):[];});
    var works=archive.querySelector('[data-tab="Works"] .col'),nodes=Array.from(works.children),figureCount=0,split=nodes.findIndex(function(node){if(node.tagName==='FIGURE')figureCount++;return figureCount===2;});
    storyNodes.nightwatch=nodes.slice(1,split);storyNodes.inssaei=nodes.slice(split);
    storyNodes.book=Array.from(document.getElementById('news-stories').content.querySelector('[data-news="book"]').childNodes);
    function baseHash(){return '#'+chapters[current].id;}
    function setState(i){
      current=Math.max(0,Math.min(chapters.length-1,i));
      chapters.forEach(function(ch,j){ch.inert=j!==current;});
      document.getElementById('chapter-count').textContent=String(current+1).padStart(2,'0')+' / '+String(chapters.length).padStart(2,'0');
      document.getElementById('chapter-name').textContent=chapters[current].dataset.label;
      document.getElementById('previous').disabled=current===0;document.getElementById('next').disabled=current===chapters.length-1;
      document.querySelectorAll('.chapter-dot').forEach(function(dot,j){if(j===current)dot.setAttribute('aria-current','page');else dot.removeAttribute('aria-current');});
      document.querySelectorAll('.nav-link').forEach(function(link){if(link.dataset.group===chapters[current].dataset.group)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
      document.getElementById('chapter-status').textContent='Chapter '+(current+1)+' of '+chapters.length+': '+chapters[current].dataset.label;
    }
    function navigate(i,push,smooth){
      i=Math.max(0,Math.min(chapters.length-1,i));setState(i);programmaticUntil=Date.now()+900;
      gallery.scrollTo({left:gallery.clientWidth*i,behavior:smooth&&!reduceMotion.matches?'smooth':'instant'});
      if(push&&location.hash!==baseHash())history.pushState(null,'',baseHash());
      if(indexDialog.open)indexDialog.close();
    }
    function relatedButton(parent,key,label){var link=document.createElement('a');link.href=storyPaths[key]||baseHash()+'/read/'+key;link.dataset.story=key;link.textContent=label;link.setAttribute('aria-haspopup','dialog');parent.appendChild(link);}
    function fillStory(key){
      readerContent.replaceChildren();
      if(key==='inssaei-photos'){
        var intro=document.createElement('p');intro.className='eyebrow';intro.textContent='INSSAEI · Krinkels HQ, Breda';readerContent.appendChild(intro);
        ['03','04','01','05','06','07'].forEach(function(n){var figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src='images/Krinkels_'+n+'_Robbert_Vogtlander.jpg';img.alt='INSSAEI at Krinkels, photograph '+n;img.loading='lazy';caption.textContent='© Robbert Vogtlander';figure.append(img,caption);readerContent.appendChild(figure);});
      }else{(storyNodes[key]||[]).forEach(function(node){readerContent.appendChild(node.cloneNode(true));});}
      readerContent.querySelectorAll('img').forEach(function(img){img.loading='lazy';});
      var related=document.createElement('div');related.className='reader-related';
      if(key==='manifesto')relatedButton(related,'why','Why the work exists');
      if(key==='artist'||key==='why')relatedButton(related,'manifesto','Read the manifesto');
      if(key==='inssaei')relatedButton(related,'inssaei-photos','View all photographs');
      if(key==='inssaei-photos')relatedButton(related,'inssaei','Read the INSSAEI story');
      if(key==='commissions')relatedButton(related,'contact','Begin a conversation');
      if(key==='uwfl'){var link=document.createElement('a');link.href='https://app.unitedwoodfloorlayers.com/';link.target='_blank';link.rel='noopener';link.textContent='Explore United Wood Floor Layers ↗';related.appendChild(link);}
      if(key==='nightwatch'){var link=document.createElement('a');link.href='https://www.thenightwatchinwood.com';link.target='_blank';link.rel='noopener';link.textContent='Visit the artwork website ↗';related.appendChild(link);}
      if(related.children.length)readerContent.appendChild(related);
    }
    function openStory(key,push){
      if(!titles[key])return;
      if(reader.open&&currentStory===key)return;
      if(currentStory)positions.set(currentStory,readerScroll.scrollTop);
      if(!reader.open)opener=document.activeElement;
      currentStory=key;document.getElementById('reader-title').textContent=titles[key];fillStory(key);
      if(!reader.open)reader.showModal();readerScroll.scrollTop=positions.get(key)||0;
      if(push){var target=baseHash()+'/read/'+key;if(location.hash.indexOf('/read/')!==-1)history.replaceState(null,'',target);else{history.pushState(null,'',target);readerPushed=true;}}
      document.getElementById('close-reader').focus({preventScroll:true});
    }
    reader.addEventListener('close',function(){
      if(currentStory)positions.set(currentStory,readerScroll.scrollTop);
      currentStory=null;
      if(skipCloseHistory)skipCloseHistory=false;
      else if(location.hash.indexOf('/read/')!==-1){if(readerPushed)history.back();else history.replaceState(null,'',baseHash());}
      readerPushed=false;if(opener&&opener.isConnected&&!opener.closest('[inert]'))opener.focus({preventScroll:true});
    });
    function applyRoute(){
      var parts=location.hash.slice(1).split('/'),i=chapters.findIndex(function(ch){return ch.id===parts[0];});
      if(i<0)i=0;navigate(i,false,false);
      if(parts[1]==='read'&&titles[parts[2]])openStory(parts[2],false);
      else if(reader.open){skipCloseHistory=true;reader.close();}
    }
    chapters.forEach(function(ch,i){
      var dot=document.createElement('button');dot.type='button';dot.className='chapter-dot';dot.setAttribute('aria-label','Go to '+ch.dataset.label);dot.addEventListener('click',function(){navigate(i,true,true);});document.getElementById('chapter-dots').appendChild(dot);
      var entry=document.createElement('button'),num=document.createElement('span');entry.type='button';num.textContent=String(i+1).padStart(2,'0');entry.append(num,document.createTextNode(ch.dataset.label));entry.addEventListener('click',function(){navigate(i,true,true);});document.getElementById('index-list').appendChild(entry);
    });
    document.addEventListener('click',function(e){
      if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      var nativeLink=e.target.closest('a');if(nativeLink&&(nativeLink.target==='_blank'||nativeLink.hasAttribute('download')))return;
      var chapterLink=e.target.closest('[data-chapter]');if(chapterLink){e.preventDefault();var i=chapters.findIndex(function(ch){return ch.id===chapterLink.dataset.chapter;});if(i>=0)navigate(i,true,true);return;}
      var storyButton=e.target.closest('[data-story]');if(storyButton&&titles[storyButton.dataset.story]){e.preventDefault();openStory(storyButton.dataset.story,true);}
    });
    document.getElementById('previous').addEventListener('click',function(){navigate(current-1,true,true);});
    document.getElementById('next').addEventListener('click',function(){navigate(current+1,true,true);});
    document.getElementById('close-reader').addEventListener('click',function(){reader.close();});
    document.getElementById('open-index').addEventListener('click',function(){indexDialog.showModal();});
    document.getElementById('close-index').addEventListener('click',function(){indexDialog.close();});
    [reader,indexDialog].forEach(function(dialog){dialog.addEventListener('click',function(e){var r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});});
    gallery.addEventListener('scroll',function(){
      clearTimeout(scrollTimer);scrollTimer=setTimeout(function(){if(reader.open)return;var i=Math.round(gallery.scrollLeft/gallery.clientWidth);if(i!==current){setState(i);history.replaceState(null,'',baseHash());}},Math.max(160,programmaticUntil-Date.now()+30));
    },{passive:true});
    document.addEventListener('keydown',function(e){
      if(reader.open||indexDialog.open||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target.closest('input,textarea,select,[contenteditable]'))return;
      if(e.key==='ArrowRight'){e.preventDefault();navigate(current+1,true,true);}else if(e.key==='ArrowLeft'){e.preventDefault();navigate(current-1,true,true);}
    });
    var resizeTimer,resizeFrame,viewport=window.visualViewport;
    function fitViewport(){
      // Keep pinch zoom native; only resize the layout at its normal scale.
      if(viewport&&Math.abs(viewport.scale-1)>.01)return;
      var height=viewport?Math.min(viewport.height,window.innerHeight):window.innerHeight;
      if(height>0)document.documentElement.style.setProperty('--viewport-height',Math.floor(height)+'px');
    }
    function resizeGallery(){
      cancelAnimationFrame(resizeFrame);
      resizeFrame=requestAnimationFrame(function(){
        fitViewport();clearTimeout(resizeTimer);
        resizeTimer=setTimeout(function(){navigate(current,false,false);},120);
      });
    }
    fitViewport();
    window.addEventListener('resize',resizeGallery,{passive:true});
    window.addEventListener('pageshow',resizeGallery,{passive:true});
    if(viewport)viewport.addEventListener('resize',resizeGallery,{passive:true});
    window.addEventListener('popstate',applyRoute);window.addEventListener('hashchange',applyRoute);applyRoute();
  })();
