// Brand configuration; the map, gallery, editor and store remain shared.
window.atlasProfile = {
  config: {brand:'PISELL',customerLibrary:true, scene:{background:0xf5f3f2,exposure:1.12,ambient:1.25,backdrop:{base:'#f4f3f3',tint:'#ffe1d7'}}},
  copy:{eyebrow:'CONNECTED BY BUSINESS',headline:'Good business.<br><span>Everywhere.</span>',regionalHeadline:'Local stories.',caption:'Explore the places, people and stories behind every business.',overview:'Discover our active customer community.',library:'Active customers',itemPlural:'locations'},
  regions:Object.fromEntries(['Asia','Europe','North America','South America','Africa','Oceania'].map(id=>[id,{description:'Discover local stories. Explore every possibility.'}])),
  landscapes:{Asia:{color:'#e49172',edge:'#b94325',terrain:'Explore the region'},Europe:{color:'#c09ec0',edge:'#7b477f',terrain:'Explore the region'},'North America':{color:'#92aaa9',edge:'#376563',terrain:'Explore the region'},'South America':{color:'#a9b485',edge:'#556b32',terrain:'Explore the region'},Africa:{color:'#d3b083',edge:'#8e612c',terrain:'Explore the region'},Oceania:{color:'#d2989f',edge:'#a44655',terrain:'Explore the region'}}
};

if(new URL(location.href).searchParams.has("embed"))document.documentElement.classList.add("is-embedded");
window.atlasProfile.regions.Europe.label=[20,69];
window.atlasProfile.regions.Asia.label=[118,65];
