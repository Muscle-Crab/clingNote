// Phone drawer: a tap on the scrim closes it. A tap inside the panel, including its links, does not.
// The X still closes. The wide layout has no scrim (the sidebar pushes the page), so those taps are not "outside".
export const dismissSidebar = ({ where, overlay }) => {
  if (where === 'inside') return false;
  if (where === 'close') return true;
  if (where === 'scrim') return !!overlay;
  return false;
};
