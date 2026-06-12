'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTrades } from '@/hooks/useTrades';
import { formatUsd, formatDate, pnlClass } from '@/lib/formatters';

const PAGE_SIZE = 20;

export function TradeHistoryTable() {
  const { data: trades, isLoading } = useTrades(200);
  const [page, setPage] = useState(0);

  const closingTrades = Array.isArray(trades) ? trades.filter((t) => t.close_size !== 0) : [];
  const totalPages = Math.ceil(closingTrades.length / PAGE_SIZE);
  const paginated = closingTrades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">Trade History</CardTitle>
          {closingTrades.length > 0 && (
            <span className="text-xs text-gray-400">{closingTrades.length} trades</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : closingTrades.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No trade history</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-gray-100">
                  <TableHead className="text-xs text-gray-400 font-medium">Time</TableHead>
                  <TableHead className="text-xs text-gray-400 font-medium">Side</TableHead>
                  <TableHead className="text-xs text-gray-400 font-medium text-right">Close Size</TableHead>
                  <TableHead className="text-xs text-gray-400 font-medium text-right">Price</TableHead>
                  <TableHead className="text-xs text-gray-400 font-medium text-right">Realised PnL</TableHead>
                  <TableHead className="text-xs text-gray-400 font-medium text-right">Fee</TableHead>
                  <TableHead className="text-xs text-gray-400 font-medium">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((trade) => {
                  const pnl = parseFloat(trade.realised_pnl);
                  const isLong = trade.size > 0;
                  return (
                    <TableRow key={trade.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(trade.create_time)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={isLong
                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50 text-xs'
                            : 'border-red-200 text-red-600 bg-red-50 text-xs'
                          }
                        >
                          {isLong ? 'BUY' : 'SELL'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{Math.abs(trade.close_size)}</TableCell>
                      <TableCell className="text-right text-sm">{formatUsd(trade.price)}</TableCell>
                      <TableCell className={`text-right text-sm ${pnlClass(pnl)}`}>
                        {formatUsd(pnl)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-gray-500">
                        {formatUsd(parseFloat(trade.fee))}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-400 capitalize">{trade.role}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
