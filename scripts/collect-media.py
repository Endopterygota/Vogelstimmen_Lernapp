"""Download attributed Commons MP3 derivatives and image thumbnails.
Original source metadata is retained alongside the app.
Run with Python 3. Reuses existing downloads; no scraping or Xeno-canto API key.
"""
import json, pathlib, urllib.request, urllib.parse, re, html, time, hashlib, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = pathlib.Path(__file__).resolve().parents[1]
SPECIES = [('amsel','Turdus merula'),('singdrossel','Turdus philomelos'),('nachtigall','Luscinia megarhynchos'),('rotkehlchen','Erithacus rubecula'),('zaunkoenig','Troglodytes troglodytes'),('moenchsgrasmuecke','Sylvia atricapilla'),('kohlmeise','Parus major'),('blaumeise','Cyanistes caeruleus'),('haussperling','Passer domesticus'),('zilpzalp','Phylloscopus collybita')]
SPECIES += [('buchfink','Fringilla coelebs'),('ringeltaube','Columba palumbus'),('tuerkentaube','Streptopelia decaocto'),('kuckuck','Cuculus canorus'),('kleiber','Sitta europaea'),('buntspecht','Dendrocopos major'),('elster','Pica pica'),('rabenkraehe','Corvus corone'),('stockente','Anas platyrhynchos'),('mauersegler','Apus apus')]
def request(url):
    for attempt in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'VogelstimmenLernapp/0.1 (+https://github.com/Endopterygota/Vogelstimmen_Lernapp)'}),timeout=90) as r: return r.read()
        except Exception:
            if attempt == 1: raise
            print('Retry', attempt+1, url[:100],flush=True)
            time.sleep(4)
def api(params):
    cache=ROOT/'.tools'/'commons-cache';cache.mkdir(exist_ok=True)
    key=hashlib.sha256(json.dumps(params,sort_keys=True).encode()).hexdigest()
    file=cache/(key+'.json')
    if file.exists(): return json.loads(file.read_text(encoding='utf-8'))
    time.sleep(2)
    result=json.loads(request('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json',**params})))
    file.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    return result
def clean(s): return html.unescape(re.sub('<[^>]+>', ' ', s)).strip()
def search(scientific, kind):
    params={'generator':'search','gsrsearch':f'filetype:{kind} intitle:"{scientific}"','gsrnamespace':6,'gsrlimit':30}
    if kind=='audio': params.update({'prop':'videoinfo','viprop':'url|extmetadata|metadata|size|derivatives'})
    else: params.update({'prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':960})
    data=api(params)
    pages=list(data.get('query',{}).get('pages',{}).values())
    for p in pages:
        if 'videoinfo' in p: p['imageinfo']=p['videoinfo']
    return pages

def audio_category(scientific):
    data=api({'generator':'categorymembers','gcmtitle':'Category:Audio files of '+scientific,'gcmtype':'file','gcmlimit':500,'prop':'videoinfo','viprop':'url|extmetadata|metadata|size|derivatives'})
    pages=list(data.get('query',{}).get('pages',{}).values())
    for p in pages:
        if 'videoinfo' in p: p['imageinfo']=p['videoinfo']
    return pages
def metadata(page):
    info=page['imageinfo'][0]; m=info.get('extmetadata',{})
    val=lambda k:clean(m.get(k,{}).get('value',''))
    def nested(key,values):
        for item in values:
            if item.get('name')==key and isinstance(item.get('value'),str): return item['value']
            if isinstance(item.get('value'),list):
                found=nested(key,item['value'])
                if found: return found
        return ''
    author=val('Artist') or nested('artist',info.get('metadata',[]))
    if 'British Library' in nested('comment',info.get('metadata',[])): author+=' / © The British Library Board'
    return {'title':page['title'],'author':author,'license':val('LicenseShortName'),'licenseUrl':val('LicenseUrl') or (info['descriptionurl'] if val('LicenseShortName')=='Public domain' else ''),'sourceUrl':info['descriptionurl'],'originalUrl':info['url'].split('?')[0],'downloadUrl':info.get('thumburl',info['url']).split('?')[0],'derivatives':info.get('derivatives',[]),'description':val('ImageDescription'),'changes':'Unveränderte Originaldatei.','width':info.get('width',0),'height':info.get('height',0),'size':info.get('size',0)}
def acceptable(m): return m['author'] and (m['license'].startswith('CC BY') or m['license'] in ['CC0','Public domain']) and m['licenseUrl']
def vocal_type(m):
    match=re.search(r'Type:\s*([^\n]+)',m['description'],re.I)
    text=match.group(1) if match else m['description']
    if re.search(r'\bdrum\b|drumming|trommel',text,re.I): return 'Trommeln & Rufe' if re.search(r'call|ruf',text,re.I) else 'Trommeln'
    if re.search(r'klopf',text,re.I): return 'Klopfen'
    song=bool(re.search(r'\b(song|singing|gesang|zang)\b',text,re.I))
    call=bool(re.search(r'\b(call|calls|ruf|rufe)\b',text,re.I))
    return 'Gesang & Rufe' if song and call else 'Gesang' if song else 'Ruf'
def main():
    catalog=json.loads((ROOT/'src/data/media.json').read_text(encoding='utf-8')) if (ROOT/'src/data/media.json').exists() else {}
    for ident,scientific in SPECIES:
        if ident in catalog and len(catalog[ident]['recordings'])>=2 and catalog[ident]['image']:
            print(ident,'already collected',flush=True);continue
        sounds=[metadata(p) for p in search(scientific,'audio') if p.get('imageinfo')]
        more=[metadata(p) for p in audio_category(scientific) if p.get('imageinfo')]
        existing={m['title'] for m in sounds}
        sounds += [m for m in more if m['title'] not in existing]
        sounds=[m for m in sounds if acceptable(m) and re.search(r'\.(ogg|mp3|wav)$',m['originalUrl'],re.I) and m['size'] < 5_000_000 and not re.search(r'(identification|species) (is )?uncertain|is it actually|different species|aberrant|imitat|artist.s hands|using.*hands|synthesi|cage in my house',m['description'],re.I) and not re.search(r'pronunciation|dawn chorus|chorus of|human|réveil des oiseaux|Buntspecht Klopfen|Ducks landing in water',m['title']+' '+m['description'],re.I)]
        def score(m):
            d=m['description'].lower()
            return ((vocal_type(m)=='Gesang')*20 + (ident=='buntspecht' and 'XC47350' in m['title'])*25 + (ident=='mauersegler' and 'flight call' in d)*30 + (ident=='stockente' and 'W1CDR0001518 BD17' in m['title'])*30 - bool(re.search('noise|traffic|interference|cowbell',d))*8 - bool(re.search('australia|new zealand',d))*15 + ('.ogg' in m['originalUrl'])*5 - m['size']/1_000_000)
        sounds.sort(key=score,reverse=True)
        chosen=sounds[:3]
        downloaded=[]
        seen_xc=set()
        for m in sounds:
            i=len(downloaded)
            if i==3: break
            xc=re.search(r'XC(\d+)',m['title'])
            if xc and xc.group(1) in seen_xc: continue
            derivative=next((d for d in m.get('derivatives',[]) if d.get('transcodekey')=='mp3'),None)
            if derivative:
                m['downloadUrl']=derivative['src'];m['changes']='MP3-Fassung von Wikimedia Commons; inhaltlich ungekürzt und unverändert.'
                ext='.mp3'
            elif re.search(r'\.(mp3|wav)$',m['originalUrl'],re.I):
                m['downloadUrl']=m['originalUrl'];ext=pathlib.PurePosixPath(m['originalUrl']).suffix.lower()
            else: continue
            local=f'media/{ident}-{hashlib.sha256(m["originalUrl"].encode()).hexdigest()[:10]}{ext}'; target=ROOT/'public'/local
            if not target.exists():
                try: target.write_bytes(request(m['downloadUrl']))
                except Exception as e:
                    print('Skipping unavailable file', m['title'], str(e)[:80],flush=True)
                    continue
                time.sleep(3)
            m['path']='/'+local
            m['kind']=vocal_type(m)
            downloaded.append(m)
            if xc: seen_xc.add(xc.group(1))
        chosen=downloaded
        images=[metadata(p) for p in search(scientific,'bitmap') if p.get('imageinfo')]
        images=[m for m in images if acceptable(m) and m['width']>=600 and m['height']>=300 and not re.search('egg|map|distribution|skeleton|museum|dead|skull|MHNT|specimen|taxiderm|skin|stamp|juvenile|jungvogel',m['title'],re.I)]
        images.sort(key=lambda m: abs(m['width']/max(1,m['height'])-1.5) + (m['size']>8_000_000)*10 - (ident=='mauersegler' and m['title']=='File:Apus apus flying.jpg')*100)
        image=None
        if images:
            image=images[0]
            # Commons provides correctly sized thumbnails; retain original attribution.
            local=f'media/{ident}-960-{hashlib.sha256(image["originalUrl"].encode()).hexdigest()[:8]}'+pathlib.PurePosixPath(urllib.parse.urlparse(image['downloadUrl']).path).suffix.lower()
            target=ROOT/'public'/local
            if not target.exists(): target.write_bytes(request(image['downloadUrl']))
            image['changes']='Vorschaufassung von Wikimedia Commons (bis 960 Pixel). Darstellung in der App teilweise beschnitten.'
            image['path']='/'+local
        catalog[ident]={'recordings':chosen,'image':image}
        print(ident, len(chosen), image['title'] if image else 'NO IMAGE',flush=True)
        (ROOT/'src/data/media.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
        time.sleep(.5)
if __name__=='__main__': main()
