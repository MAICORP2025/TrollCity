import React from 'react';
import { Vote as VoteIcon, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function VotingTab(props: any) {
   const votingLaws = props.laws?.filter((l: any) => l.status === 'voting') || [];
   const onVoteOnLaw = props.onVoteOnLaw;
   const votingLawId = props.votingLawId || null;

   const handleVote = async (lawId: string, vote: 'yes' | 'no') => {
     if (!onVoteOnLaw) return;
     try {
       await onVoteOnLaw(lawId, vote);
     } catch (err) {
       console.error('Vote failed:', err);
     }
   };

   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
           <h2 className="text-2xl font-bold flex items-center gap-3">
             <VoteIcon className="text-purple-400" />
             Voting Center
           </h2>
           <p className="text-slate-400 mt-1">Cast your votes on active legislation</p>
         </div>
       </div>

       {votingLaws.length === 0 ? (
         <div className="text-center py-12 text-slate-500">
           <VoteIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
           <h3 className="text-xl font-medium text-slate-300 mb-2">No Active Votes</h3>
           <p>There are no laws currently up for vote.</p>
         </div>
       ) : (
         <div className="space-y-4">
           {votingLaws.map((law: any) => (
             <div key={law.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
               <div className="flex items-start justify-between mb-3">
                 <div>
                   <h4 className="font-bold text-lg">{law.title}</h4>
                   <p className="text-slate-400 text-sm mt-1">{law.description}</p>
                 </div>
                 <span className="px-3 py-1 rounded-full text-xs font-bold border bg-blue-500/20 text-blue-400 border-blue-500/30">
                   VOTING
                 </span>
               </div>

               <div className="flex items-center gap-4 mb-4">
                 <div className="flex-1 bg-slate-950 rounded-full h-3 overflow-hidden">
                   <div
                     className="h-full bg-green-500 transition-all"
                     style={{ width: `${(law.yes_votes / (law.yes_votes + law.no_votes || 1)) * 100}%` }}
                   />
                 </div>
                 <div className="text-sm">
                   <span className="text-green-400 font-bold">{law.yes_votes}</span>
                   <span className="text-slate-500"> / </span>
                   <span className="text-red-400 font-bold">{law.no_votes}</span>
                 </div>
               </div>

               <div className="flex gap-2">
                 <button
                   onClick={() => handleVote(law.id, 'yes')}
                   disabled={votingLawId === law.id}
                   className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-bold transition-colors"
                 >
                   <ThumbsUp className="w-4 h-4 inline mr-1" />
                   Vote Yes
                 </button>
                 <button
                   onClick={() => handleVote(law.id, 'no')}
                   disabled={votingLawId === law.id}
                   className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg font-bold transition-colors"
                 >
                   <ThumbsDown className="w-4 h-4 inline mr-1" />
                   Vote No
                 </button>
               </div>
             </div>
           ))}
         </div>
       )}
     </div>
   );
 }
