alter table public.plans alter column yearly_discount_percent set default 10;

update public.plans
set
  yearly_discount_percent = 10,
  yearly_price = case id
    when 'discovery' then 0
    when 'client-essential' then 205.20
    when 'business' then 853.20
    when 'cabinet-solo' then 1069.20
    when 'cabinet-pro' then 2689.20
    else yearly_price
  end
where id in ('discovery', 'client-essential', 'business', 'cabinet-solo', 'cabinet-pro', 'cabinet-premium');
