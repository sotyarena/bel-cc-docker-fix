const socket = io({ transports: ['websocket', 'polling'], reconnection: true });
let state = { teams: [], roundActive: false, buzzerResults: [] };
let myTeamId = localStorage.getItem('quizTeamId');
let myMemberName = localStorage.getItem('quizMemberName');
const $ = id => document.getElementById(id);

function toast(msg){const e=$('toast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}
function setConnection(ok){const e=$('connection');e.textContent=ok?'● Terhubung ke server':'● Terputus dari server';e.className='connection '+(ok?'online':'offline')}
function createTeam(){socket.emit('createTeam',{name:$('teamName').value,color:$('teamColor').value,memberName:$('captainName').value})}
function joinTeam(){const teamId=$('teamSelect').value, memberName=$('memberName').value;socket.emit('joinTeam',{teamId,memberName})}
function buzz(){if(!state.roundActive)return toast('Ronde belum dimulai.');socket.emit('buzz')}

socket.on('connect',()=>{setConnection(true);if(myTeamId&&myMemberName)socket.emit('restoreParticipant',{teamId:myTeamId,memberName:myMemberName})});
socket.on('disconnect',()=>setConnection(false));
socket.on('connect_error',()=>setConnection(false));
socket.on('connected',()=>setConnection(true));
socket.on('restoreFailed',()=>{localStorage.removeItem('quizTeamId');localStorage.removeItem('quizMemberName');myTeamId=null;myMemberName=null});
socket.on('teamCreated',({id})=>{myTeamId=id;localStorage.setItem('quizTeamId',id);toast('Tim berhasil dibuat!')});
socket.on('joinedTeam',({teamId,memberName})=>{myTeamId=teamId;myMemberName=memberName;localStorage.setItem('quizTeamId',teamId);localStorage.setItem('quizMemberName',memberName);$('buzzerArea').classList.remove('hidden');toast('Berhasil masuk tim!')});
socket.on('buzzRejected',toast);
socket.on('errorMessage',toast);
socket.on('state',s=>{state=s;render()});

function render(){
$('teamSelect').innerHTML=state.teams.length?state.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join(''):'<option value="">Belum ada tim</option>';
$('teams').innerHTML=state.teams.map(t=>`<div class="team-card" style="--team:${t.color}"><div class="team-dot"></div><div><strong>${esc(t.name)}</strong><small>${t.members.length} peserta</small></div></div>`).join('');
const myTeam=state.teams.find(t=>t.id===myTeamId);if(myTeam){$('myTeam').classList.remove('hidden');$('myTeam').innerHTML=`Tim Anda: <strong>${esc(myTeam.name)}</strong> · ${myTeam.members.length} peserta`;$('buzzerArea').classList.remove('hidden')}
$('roundStatus').textContent=state.roundActive?'🟢 RONDE AKTIF — TEKAN BUZZ!':'🟡 Menunggu juri memulai ronde...';
const already=state.buzzerResults.some(r=>r.teamId===myTeamId);$('buzzButton').disabled=!state.roundActive||!myTeamId||already;$('buzzButton').textContent=already?'SUDAH MENEKAN':'BUZZ!';
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
