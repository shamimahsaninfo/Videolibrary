const express=require('express');const {execFile}=require('child_process');
const fs=require('fs');const os=require('os');const path=require('path');
const app=express();app.use(express.static('public'));
const KEY=process.env.APP_PASSWORD||'';
const OK=/^https:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.watch|fb\.com)\//i;
function guard(req,res,next){
  if(KEY&&req.query.key!==KEY)return res.status(401).json({error:'পাসওয়ার্ড ভুল'});
  if(!OK.test(req.query.url||''))return res.status(400).json({error:'শুধু ফেসবুকের লিংক চলবে'});
  next();
}
app.get('/api/info',guard,(req,res)=>{
  execFile('yt-dlp',['-J','--no-playlist','--no-warnings','--',req.query.url],{maxBuffer:50*1024*1024,timeout:60000},(err,out)=>{
    if(err)return res.status(422).json({error:'ভিডিও আনা যায়নি। ভিডিওটি পাবলিক কিনা দেখুন।'});
    const j=JSON.parse(out),fm=j.formats||[];
    const heights=[...new Set(fm.filter(f=>f.vcodec&&f.vcodec!=='none'&&f.height).map(f=>f.height))].sort((a,b)=>b-a);
    const prog=fm.filter(f=>f.url&&f.vcodec&&f.vcodec!=='none'&&f.acodec&&f.acodec!=='none').sort((a,b)=>(a.height||0)-(b.height||0));
    res.json({title:j.title||'',thumbnail:j.thumbnail||'',heights,preview:prog[0]?prog[0].url:''});
  });
});
app.get('/api/download',guard,(req,res)=>{
  const h=parseInt(req.query.h)||0;
  const sel=h?`bv*[height<=${h}]+ba/b[height<=${h}]/b`:'bv*+ba/b';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v-')),f=path.join(dir,'video.mp4');
  const clean=()=>fs.rmSync(dir,{recursive:true,force:true});
  execFile('yt-dlp',['-f',sel,'--merge-output-format','mp4','--no-playlist','-o',f,'--',req.query.url],{timeout:600000},err=>{
    if(err||!fs.existsSync(f)){clean();return res.status(422).send('ডাউনলোড ব্যর্থ হয়েছে');}
    res.download(f,`video-${h||'best'}p.mp4`,clean);
  });
});
app.listen(process.env.PORT||3000);
