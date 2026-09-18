export const BLOCKS={
  air:{id:0,name:'Air',solid:false,transparent:true},
  grass:{id:1,name:'Grass Block',solid:true,hardness:.6,drop:'grass',textures:{top:'grass_top',side:'grass_side',bottom:'dirt'}},
  dirt:{id:2,name:'Dirt',solid:true,hardness:.5,drop:'dirt',textures:{all:'dirt'}},
  stone:{id:3,name:'Stone',solid:true,hardness:1.5,drop:'cobblestone',textures:{all:'stone'}},
  cobblestone:{id:4,name:'Cobblestone',solid:true,hardness:2,textures:{all:'cobblestone'}},
  sand:{id:5,name:'Sand',solid:true,hardness:.5,drop:'sand',textures:{all:'sand'}},
  wood:{id:6,name:'Wood',solid:true,hardness:2,drop:'wood',textures:{top:'log_top',side:'log_side',bottom:'log_top'}},
  leaves:{id:7,name:'Leaves',solid:true,transparent:true,hardness:.2,drop:'leaves',textures:{all:'leaves'}},
  planks:{id:8,name:'Planks',solid:true,hardness:2,drop:'planks',textures:{all:'planks'}},
  coal_ore:{id:9,name:'Coal Ore',solid:true,hardness:3,drop:'coal',textures:{all:'coal_ore'}},
  iron_ore:{id:10,name:'Iron Ore',solid:true,hardness:3,drop:'raw_iron',textures:{all:'iron_ore'}},
  copper_ore:{id:11,name:'Copper Ore',solid:true,hardness:3,drop:'raw_copper',textures:{all:'copper_ore'}},
  gold_ore:{id:12,name:'Gold Ore',solid:true,hardness:3,drop:'raw_gold',textures:{all:'gold_ore'}},
  diamond_ore:{id:13,name:'Diamond Ore',solid:true,hardness:4,drop:'diamond',textures:{all:'diamond_ore'}},
  snow:{id:14,name:'Snow',solid:true,hardness:.2,drop:'snow',textures:{all:'snow'}},
  sandstone:{id:15,name:'Sandstone',solid:true,hardness:.8,drop:'sandstone',textures:{all:'sandstone'}},
  glass:{id:16,name:'Glass',solid:true,transparent:true,hardness:.3,drop:'glass',textures:{all:'glass'}},
  brick:{id:17,name:'Bricks',solid:true,hardness:2,drop:'brick',textures:{all:'brick'}},
  crafting_table:{id:18,name:'Crafting Table',solid:true,hardness:2.5,drop:'crafting_table',textures:{all:'planks'}},
  furnace:{id:19,name:'Furnace',solid:true,hardness:3,drop:'furnace',textures:{all:'stone'}},
  torch:{id:20,name:'Torch',solid:false,transparent:true,light:12,drop:'torch',textures:{all:'log_side'}},
  water:{id:21,name:'Water',solid:false,transparent:true,liquid:true},
  bedrock:{id:22,name:'Bedrock',solid:true,hardness:999,textures:{all:'bedrock'}}
};
export const BLOCK_BY_ID=Object.fromEntries(Object.values(BLOCKS).map(b=>[b.id,b]));
export const HOTBAR_BLOCKS=['grass','dirt','stone','sand','wood','planks','cobblestone','glass','torch'];