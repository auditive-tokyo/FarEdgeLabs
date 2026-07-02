import React from 'react';
import { animated, SpringValue } from '@react-spring/web';

// Animated list item with spring animations
export const AnimatedLi = animated.li as unknown as React.FC<
  Omit<React.LiHTMLAttributes<HTMLLIElement>, 'style'> & { 
    style?: {
      transform?: SpringValue<string>;
      opacity?: SpringValue<number>;
      y?: SpringValue<number>;
      color?: SpringValue<string>;
    }
  }
>;

export default AnimatedLi;