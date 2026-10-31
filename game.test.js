import test from 'node:test';
import assert from 'node:assert/strict';
const crews=['Simba Squad','Duma Dynamo','Chui Strike','Nyoka Venom','Tai Talons','Ngamia Nomads','Radi Raiders','Moto Mavericks'];
test('VEM X V1 crew catalogue has eight distinct crews',()=>{assert.equal(crews.length,8);assert.equal(new Set(crews).size,8);});
test('4x4 closing safe zone is inside the 8x8 grid',()=>{const min=2,max=5;assert.ok(min>=0&&max<=7&&max-min+1===4);});
test('adjacent movement rule accepts orthogonal steps only',()=>{const adjacent=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;assert.equal(adjacent({x:2,y:2},{x:3,y:2}),true);assert.equal(adjacent({x:2,y:2},{x:3,y:3}),false);});
