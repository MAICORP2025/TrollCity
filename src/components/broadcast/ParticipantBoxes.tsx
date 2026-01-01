import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

type Guest = { name: string };

interface ParticipantBoxesProps {
  guests: Guest[];
}

export default function ParticipantBoxes({ guests }: ParticipantBoxesProps) {

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Guests ({guests.length})
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {guests.map((guest, index) => (
          <Card key={index} className="bg-gray-800/50 border-gray-700 relative group">
            <CardContent className="p-4">
              <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-green-500/20 rounded-lg flex items-center justify-center mb-2">
                <Users className="w-12 h-12 text-gray-600" />
              </div>
              <p className="text-sm font-semibold text-white text-center truncate">
                {guest.name}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
