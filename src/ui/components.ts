// Contract Crown UI Components
// Reusable UI components

export const Button = (props: { label: string; onClick: () => void }) => {
  return {
    type: 'button',
    label: props.label,
    onClick: props.onClick
  };
};

export const CardComponent = (props: { suit: string; rank: number }) => {
  return {
    type: 'card',
    suit: props.suit,
    rank: props.rank
  };
};
