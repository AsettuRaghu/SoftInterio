"use client";

import React from "react";
import Link from "next/link";
import { Vendor } from "@/types/stock";
import {
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

interface VendorCardProps {
  vendor: Vendor;
  onClick?: () => void;
}

export function VendorCard({ vendor, onClick }: VendorCardProps) {
  const renderRating = (rating: number | undefined) => {
    const stars = [];
    const r = rating || 0;
    for (let i = 1; i <= 5; i++) {
      if (i <= r) {
        stars.push(
          <StarIconSolid key={i} className="h-4 w-4 text-yellow-400" />
        );
      } else {
        stars.push(<StarIcon key={i} className="h-4 w-4 text-slate-300" />);
      }
    }
    return stars;
  };

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{vendor.name}</h3>
            {!vendor.is_active && (
              <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">{vendor.code}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {renderRating(vendor.rating)}
        </div>
      </div>

      {vendor.contact_person && (
        <p className="text-sm text-slate-700 mb-3">{vendor.contact_person}</p>
      )}

      <div className="space-y-2 text-sm">
        {vendor.phone && (
          <div className="flex items-center gap-2 text-slate-600">
            <PhoneIcon className="h-4 w-4 text-slate-400" />
            <span>{vendor.phone}</span>
          </div>
        )}
        {vendor.email && (
          <div className="flex items-center gap-2 text-slate-600">
            <EnvelopeIcon className="h-4 w-4 text-slate-400" />
            <span className="truncate">{vendor.email}</span>
          </div>
        )}
        {vendor.city && (
          <div className="flex items-center gap-2 text-slate-600">
            <MapPinIcon className="h-4 w-4 text-slate-400" />
            <span>
              {vendor.city}
              {vendor.state ? `, ${vendor.state}` : ""}
            </span>
          </div>
        )}
      </div>

      {vendor.gst_number && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            GST: <span className="text-slate-700">{vendor.gst_number}</span>
          </p>
        </div>
      )}

      {vendor.payment_terms && (
        <div className="mt-2">
          <p className="text-xs text-slate-500">
            Terms:{" "}
            <span className="text-slate-700">{vendor.payment_terms}</span>
          </p>
        </div>
      )}
    </div>
  );
}
