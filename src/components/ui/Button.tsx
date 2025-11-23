import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm hover:shadow-md",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 shadow-sm",
        outline:
          "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:ring-slate-500",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500",
        ghost:
          "text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500",
        link: "text-blue-600 underline-offset-4 hover:underline focus:ring-blue-500",
        success:
          "bg-green-500 text-white hover:bg-green-600 focus:ring-green-500 shadow-sm",
        warning:
          "bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 shadow-sm",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-lg px-6",
        icon: "h-10 w-10",
        xs: "h-8 rounded-md px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
