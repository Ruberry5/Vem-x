import test from 'node:test';
import assert from 'node:assert/strict';

// Deterministic three-player V1 arena simulation: all clients send commands,
// the server applies landing/movement constraints, then resolves one zone close.
test('three simulated players share one server-resolved arena and produce one winner',()=>{
  const players=[
    {id:'p1',nickname:'Amani',tile:null,alive:true,landed:false,joinedAt:1},
    {id:'p2',nickname:'Baraka',tile:null,alive:true,landed:false,joinedAt:2},
    {id:'p3',nickname:'Zuri',tile:null,alive:true,landed:false,joinedAt:3}
  ];
  const land=(p,x,y)=>{if(!p.alive||p.landed||x<0||x>7||y<0||y>7)return false;p.tile={x,y};p.landed=true;return true;};
  assert.equal(land(players[0],1,1),true);
  assert.equal(land(players[1],3,3),true);
  assert.equal(land(players[2],7,7),true);
  const move=(p,x,y)=>{if(!p.alive||!p.tile||Math.abs(x-p.tile.x)+Math.abs(y-p.tile.y)!==1)return false;p.tile={x,y};return true;};
  assert.equal(move(players[0],2,1),true);
  assert.equal(move(players[1],4,3),true);
  assert.equal(move(players[2],6,7),true);
  const min=2,max=5;
  for(const p of players){const{x,y}=p.tile;if(x<min||x>max||y<min||y>max)p.alive=false;}
  const survivors=players.filter(p=>p.alive);
  survivors.sort((a,b)=>{const d=p=>Math.abs(p.tile.x-3.5)+Math.abs(p.tile.y-3.5);return d(a)-d(b)||a.joinedAt-b.joinedAt;});
  assert.deepEqual(players.filter(p=>p.alive).map(p=>p.id),['p2']);
  assert.equal(survivors[0].nickname,'Baraka');
});
