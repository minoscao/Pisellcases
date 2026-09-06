export const regions = [
  {id:'Asia',name:'Asia',en:'ASIA',center:[94,28],span:10.5,label:[96,69],description:'Playful spaces. Shared experiences. Across borders.'},
  {id:'Europe',name:'Europe',en:'EUROPE',center:[19,51],span:5.7,label:[37,66],description:'Every new location begins another story.'},
  {id:'North America',name:'North America',en:'NORTH AMERICA',center:[-103,36],span:9,label:[-106,43],description:'Discover our places and stories across North America.'},
  {id:'South America',name:'South America',en:'SOUTH AMERICA',center:[-61,-18],span:8,label:[-89,-24],description:'Discover our places and stories across South America.'},
  {id:'Africa',name:'Africa',en:'AFRICA',center:[20,4],span:8,label:[-7,-5],description:'Discover our places and stories across Africa.'},
  {id:'Oceania',name:'Oceania',en:'OCEANIA',center:[139,-25],span:7,label:[160,-43],description:'Where family, play and everyday life come together.'}
];
const profile = globalThis.window?.atlasProfile || {};
for (const region of regions) Object.assign(region, profile.regions?.[region.id]);
export const regionById = Object.fromEntries(regions.map(r=>[r.id,r]));
export const landscapes = {
  Asia:{color:'#387fc5',edge:'#89c9ff',terrain:'Alpine ridges · Forests'},
  Europe:{color:'#8778bf',edge:'#c9b7ff',terrain:'Alpine peaks · Woodlands'},
  'North America':{color:'#3b9d9f',edge:'#8de3d7',terrain:'Rocky peaks · Boreal forests'},
  'South America':{color:'#478960',edge:'#a1d994',terrain:'Andes · Rainforests'},
  Africa:{color:'#c8944a',edge:'#f8d699',terrain:'Desert dunes · Savannas'},
  Oceania:{color:'#bd7968',edge:'#f7c1a4',terrain:'Red earth · Coastal forests'}
};
export const config = {brand:'YIFUN',title:'Play. Beyond borders.',locale:'en-US',areaUnit:'m²',render:{dpr:1.5,scale:18,accent:0x45d6ff,land:0x0c477e,edge:0x329cda,background:0x030b18,bloom:{strength:.7,radius:.45,threshold:.72},maxRoutes:18},motion:{camera:0.075,lift:0.09}};
Object.assign(config, profile.config);
for (const id of Object.keys(landscapes)) Object.assign(landscapes[id], profile.landscapes?.[id]);
export const copy = {eyebrow:'SPACES THAT CONNECT US',headline:'Play.<br><span>Beyond borders.</span>',regionalHeadline:'Places to play.',caption:'Creating places to play. Connecting people everywhere.',overview:'Creating shared joy across cultures and cities.',library:'Local library',...profile.copy};
export const formatNumber = value => new Intl.NumberFormat(config.locale).format(value);
export const areaText = value => value==null?'Area not provided':`${formatNumber(value)} ${config.areaUnit}`;
export const locationText = item => [item.city,item.country].filter(Boolean).join(' · ');
export const summary = items => ({count:items.length,countries:new Set(items.map(i=>i.country).filter(Boolean)).size,area:items.reduce((sum,i)=>sum+(i.area||0),0)});



