export interface GateFuturesAccount {
  total: string;
  unrealised_pnl: string;
  position_margin: string;
  order_margin: string;
  available: string;
  point: string;
  currency: string;
  in_dual_mode: boolean;
  enable_credit: boolean;
  history: {
    dnw: string;
    pnl: string;
    fee: string;
    refr: string;
    fund: string;
    point_dnw: string;
    point_fee: string;
    point_refr: string;
    bonus_dnw: string;
    bonus_offset: string;
  };
}

export interface GateFuturesPosition {
  user: number;
  contract: string;
  size: number;
  leverage: string;
  risk_limit: string;
  leverage_max: string;
  maintenance_rate: string;
  value: string;
  margin: string;
  entry_price: string;
  liq_price: string;
  mark_price: string;
  initial_margin: string;
  maintenance_margin: string;
  unrealised_pnl: string;
  realised_pnl: string;
  history_pnl: string;
  last_close_pnl: string;
  realised_point: string;
  history_point: string;
  adl_ranking: number;
  pending_orders: number;
  close_order: {
    id: number;
    price: string;
    is_liq: boolean;
  } | null;
  mode: string;
  update_time: number;
  open_time: number;
}

export interface GateFuturesTrade {
  id: number;
  create_time: number;
  create_time_ms: number;
  contract: string;
  order_id: string;
  size: number;
  price: string;
  role: 'taker' | 'maker';
  text: string;
  fee: string;
  point_fee: string;
  close_size: number;
  realised_pnl: string;
}

export interface GateFuturesPositionClose {
  time: number;
  first_open_time: number;
  contract: string;
  side: 'long' | 'short';
  pnl: string;
  pnl_pnl: string;
  pnl_fee: string;
  pnl_fund: string;
  /** avg price of long fills — entry for longs, exit for shorts */
  long_price: string;
  /** avg price of short fills — exit for longs, entry for shorts */
  short_price: string;
  accum_size: string;
  max_size: string;
  leverage: string;
  text: string;
  margin_mode: string;
}

export interface GateAccountBookEntry {
  time: number;
  change: string;
  balance: string;
  text: string;
  type: string;
}
