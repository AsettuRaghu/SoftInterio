"use client";

import React, { useState, useEffect } from "react";
import {
  HomeModernIcon,
  CubeIcon,
  ChevronRightIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { ProjectRoom } from "@/types/projects";

interface ProjectRoomsTabProps {
  projectId: string;
  quotationId?: string;
}

// Format currency
const formatCurrency = (amount: number | undefined) => {
  if (!amount) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function RoomsTab({ projectId }: ProjectRoomsTabProps) {
  const [rooms, setRooms] = useState<ProjectRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkedQuotationId, setLinkedQuotationId] = useState<string | null>(
    null
  );
  const [linkedQuotationNumber, setLinkedQuotationNumber] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetchRooms();
  }, [projectId]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch rooms via the project API (handles lead-linked quotations)
      const response = await fetch(`/api/projects/${projectId}/rooms`);
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();

      setRooms(data.rooms || []);
      setLinkedQuotationId(data.quotation_id || null);
      setLinkedQuotationNumber(data.quotation_number || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-slate-200 rounded"></div>
        <div className="h-20 bg-slate-200 rounded"></div>
        <div className="h-20 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        <p>Error loading rooms: {error}</p>
        <button
          onClick={fetchRooms}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!linkedQuotationId || rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <HomeModernIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 font-medium">No Rooms/Spaces Found</p>
        <p className="text-slate-500 text-sm mt-1">
          {!linkedQuotationId
            ? "This project doesn't have a linked quotation with room/space data."
            : "The linked quotation doesn't have any spaces defined."}
        </p>
      </div>
    );
  }

  // Calculate totals
  const totalValue = rooms.reduce((sum, room) => sum + room.room_total, 0);
  const totalComponents = rooms.reduce(
    (sum, room) => sum + room.component_count,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-medium text-slate-900">Project Rooms</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rooms and spaces from the linked quotation
            {linkedQuotationNumber && (
              <span className="ml-1 font-medium text-slate-700">
                ({linkedQuotationNumber})
              </span>
            )}
          </p>
        </div>
        {linkedQuotationId && (
          <a
            href={`/dashboard/quotations/${linkedQuotationId}`}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <LinkIcon className="w-4 h-4" />
            View Quotation
          </a>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Total Rooms</p>
          <p className="text-lg font-bold text-slate-900">{rooms.length}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Total Components</p>
          <p className="text-lg font-bold text-slate-900">{totalComponents}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Total Value</p>
          <p className="text-lg font-bold text-green-600">
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rooms.map((room) => (
          <RoomCard
            key={room.room_id}
            room={room}
            quotationId={linkedQuotationId}
          />
        ))}
      </div>
    </div>
  );
}

// Room Card Component
interface RoomCardProps {
  room: ProjectRoom;
  quotationId: string;
}

function RoomCard({ room, quotationId }: RoomCardProps) {
  return (
    <a
      href={`/dashboard/quotations/${quotationId}?space=${room.room_id}`}
      className="block p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <HomeModernIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-slate-900">{room.room_name}</h4>
            {room.space_type && (
              <p className="text-xs text-slate-500">{room.space_type}</p>
            )}
            {room.room_description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {room.room_description}
              </p>
            )}
          </div>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-slate-400" />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 text-slate-500">
          <CubeIcon className="w-4 h-4" />
          <span className="text-xs">{room.component_count} components</span>
        </div>
        <span className="text-sm font-medium text-slate-900">
          {formatCurrency(room.room_total)}
        </span>
      </div>
    </a>
  );
}
