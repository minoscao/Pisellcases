export const caseTypes = [
  ['playground','游乐场'], ['restaurant','餐饮'], ['kidscafe','Kids cafe'],
  ['beauty','美业'], ['sports','体育'], ['education','教育'], ['other','其他']
].map(([value,label])=>({value,label}));
export const continentOptions = ['Asia','Europe','North America','South America','Africa','Oceania'];
export const photoLimits = {count:24, bytes:10*1024*1024, types:['image/jpeg','image/png','image/webp']};
export const typeLabel = value => caseTypes.find(t=>t.value===value)?.label || '';
export function newCase(){const id=crypto.randomUUID();return {id,customerId:id,title:'',address:'',country:'',city:'',continent:'Asia',lat:null,lon:null,year:null,area:null,type:'',industry:'',status:'active',photos:[],cover:null,description:'',googleMapsUrl:'',googlePlaceId:'',revision:0};}
export function caseErrors(item){
  const errors={};
  if(!item.title?.trim()||item.title.length>160)errors.title='请输入项目名称，最多 160 字';
  if(!item.address?.trim()||item.address.length>500)errors.address='请输入完整地址，最多 500 字';
  if(!item.country?.trim()||item.country.length>100)errors.country='请输入国家或地区';
  if(!item.city?.trim()||item.city.length>100)errors.city='请输入城市';
  if(!continentOptions.includes(item.continent))errors.continent='请选择所属大洲';
  if(!caseTypes.some(t=>t.value===item.type))errors.type='请选择项目类型';
  if(!Number.isFinite(item.lat)||Math.abs(item.lat)>90||!Number.isFinite(item.lon)||Math.abs(item.lon)>180)errors.lat='请确认项目在地图上的准确位置';
  if(item.year!==null&&(!Number.isInteger(item.year)||item.year<1900||item.year>2100))errors.year='年份应为 1900–2100 之间的整数';
  if(item.area!==null&&(!Number.isFinite(item.area)||item.area<=0))errors.area='面积应大于 0';
  if(!Array.isArray(item.photos)||!item.photos.length||item.photos.length>photoLimits.count)errors.photos=`请上传 1–${photoLimits.count} 张图片`;
  if(item.photos?.length&&!item.photos.includes(item.cover))errors.photos='请从上传的图片中选择封面';
  return errors;
}
export function parseGoogleMapsLink(value){
  let url;try{url=new URL(value);}catch{throw new Error('请粘贴完整的 Google Maps 链接');}
  if(!/^https?:$/.test(url.protocol)||!(/(^|\.)google\.(com|com\.au|co\.jp|co\.uk|cn|com\.hk)$/.test(url.hostname)||url.hostname==='maps.app.goo.gl'||url.hostname==='goo.gl'))throw new Error('请使用 Google Maps 的地点链接');
  if(url.hostname==='maps.app.goo.gl'||url.hostname==='goo.gl')throw new Error('请先在浏览器打开短链接，再复制地址栏中的完整地点链接');
  const decoded=decodeURIComponent(url.href),exact=decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const query=url.searchParams.get('query')||url.searchParams.get('q')||'';
  const pair=exact || query.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  // A camera centre is not necessarily the selected business location.
  if(!pair)throw new Error('这个链接没有准确地点坐标。请在 Google Maps 右键门店位置，复制经纬度到下方');
  const lat=Number(pair[1]),lon=Number(pair[2]);
  if(Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('链接中的坐标无效');
  return {lat,lon,googleMapsUrl:url.href,googlePlaceId:url.searchParams.get('query_place_id')||''};
}
