"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Vendor, Material } from "@/types/stock";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

interface POItem {
  material_id: string;
  material_name: string;
  material_sku: string;
  unit: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  discount_percent: number;
  total_amount: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [items, setItems] = useState<POItem[]>([]);

  // Material search
  const [materialSearch, setMaterialSearch] = useState("");
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

  // Fetch vendors and materials
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [vendorsRes, materialsRes] = await Promise.all([
          fetch("/api/stock/vendors"),
          fetch("/api/stock/materials"),
        ]);

        if (vendorsRes.ok) {
          const data = await vendorsRes.json();
          setVendors(data.vendors || []);
        }

        if (materialsRes.ok) {
          const data = await materialsRes.json();
          setMaterials(data.materials || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate item total
  const calculateItemTotal = (item: POItem): number => {
    const subtotal = item.quantity * item.unit_price;
    const discount = subtotal * (item.discount_percent / 100);
    const taxable = subtotal - discount;
    const tax = taxable * (item.tax_percent / 100);
    return taxable + tax;
  };

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const totalDiscount = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unit_price * (item.discount_percent / 100),
    0
  );
  const taxableAmount = subtotal - totalDiscount;
  const totalTax = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unit_price;
    const itemDiscount = itemSubtotal * (item.discount_percent / 100);
    const itemTaxable = itemSubtotal - itemDiscount;
    return sum + itemTaxable * (item.tax_percent / 100);
  }, 0);
  const totalAmount = taxableAmount + totalTax;

  // Add material to items
  const addMaterial = (material: Material) => {
    // Check if already added
    if (items.some((item) => item.material_id === material.id)) {
      setMaterialSearch("");
      setShowMaterialDropdown(false);
      return;
    }

    const newItem: POItem = {
      material_id: material.id,
      material_name: material.name,
      material_sku: material.sku,
      unit: material.unit_of_measure || "pcs",
      quantity: 1,
      unit_price: 0,
      tax_percent: 18,
      discount_percent: 0,
      total_amount: 0,
    };

    newItem.total_amount = calculateItemTotal(newItem);
    setItems([...items, newItem]);
    setMaterialSearch("");
    setShowMaterialDropdown(false);
  };

  // Update item
  const updateItem = (
    index: number,
    field: keyof POItem,
    value: string | number
  ) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    updatedItems[index].total_amount = calculateItemTotal(updatedItems[index]);
    setItems(updatedItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Filter materials for search
  const filteredMaterials = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
      m.sku.toLowerCase().includes(materialSearch.toLowerCase())
  );

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorId) {
      setError("Please select a vendor");
      return;
    }

    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/stock/purchase-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendor_id: vendorId,
          order_date: orderDate,
          expected_delivery: expectedDelivery || null,
          payment_terms: paymentTerms || null,
          notes: notes || null,
          shipping_address: shippingAddress || null,
          items: items.map((item) => ({
            material_id: item.material_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_percent: item.tax_percent,
            discount_percent: item.discount_percent,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create purchase order");
      }

      const data = await response.json();
      router.push(`/dashboard/stock/purchase-orders/${data.purchaseOrder.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create purchase order"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/stock/purchase-orders"
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                <Link href="/dashboard" className="hover:text-slate-700">
                  Dashboard
                </Link>
                <span>/</span>
                <Link href="/dashboard/stock" className="hover:text-slate-700">
                  Stock
                </Link>
                <span>/</span>
                <Link
                  href="/dashboard/stock/purchase-orders"
                  className="hover:text-slate-700"
                >
                  Purchase Orders
                </Link>
                <span>/</span>
                <span className="text-slate-700">New</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900">
                New Purchase Order
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Creating..." : "Create PO"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">
            Order Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Vendor <span className="text-red-500">*</span>
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select vendor...</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expected Delivery
              </label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Terms
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g., Net 30"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Shipping Address
            </label>
            <textarea
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              rows={2}
              placeholder="Enter delivery address..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Line Items</h2>
            <div className="relative">
              <div className="flex items-center">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={materialSearch}
                    onChange={(e) => {
                      setMaterialSearch(e.target.value);
                      setShowMaterialDropdown(true);
                    }}
                    onFocus={() => setShowMaterialDropdown(true)}
                    placeholder="Search materials..."
                    className="w-64 pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Material dropdown */}
              {showMaterialDropdown && materialSearch && (
                <div className="absolute z-10 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredMaterials.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">
                      No materials found
                    </div>
                  ) : (
                    filteredMaterials.slice(0, 10).map((material) => (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() => addMaterial(material)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {material.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              SKU: {material.sku} | Unit:{" "}
                              {material.unit_of_measure || "pcs"}
                            </div>
                          </div>
                          <PlusIcon className="h-4 w-4 text-blue-600" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No items added yet</p>
              <p className="text-xs mt-1">
                Search and add materials from the search box above
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                      Material
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-24">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-16">
                      Unit
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">
                      Unit Price
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-20">
                      Tax %
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-20">
                      Disc %
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">
                      Total
                    </th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={item.material_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-slate-900">
                          {item.material_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.material_sku}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "quantity",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 text-sm text-center border border-slate-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-slate-600">
                        {item.unit}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "unit_price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 text-sm text-right border border-slate-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.tax_percent}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "tax_percent",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 text-sm text-center border border-slate-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.discount_percent}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "discount_percent",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 text-sm text-center border border-slate-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          {items.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Discount:</span>
                      <span className="font-medium text-green-600">
                        -{formatCurrency(totalDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-medium">
                      {formatCurrency(totalTax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-semibold border-t pt-2">
                    <span className="text-slate-900">Total:</span>
                    <span className="text-blue-600">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            Additional Notes
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Enter any additional notes or instructions..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </div>
  );
}
