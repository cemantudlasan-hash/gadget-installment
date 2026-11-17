
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Gadget Installment Management',
  description: 'Manage gadget sales, installments, and commissions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Intercept setAttribute to stop browser extensions from injecting bis_skin_checked / bis_size
                  var origSetAttr = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, val) {
                    if (name === 'bis_skin_checked' || name === 'bis_size' || name === 'cz-shortcut-listen') {
                      return;
                    }
                    return origSetAttr.apply(this, arguments);
                  };
                  var origSetAttrNode = Element.prototype.setAttributeNode;
                  Element.prototype.setAttributeNode = function(attr) {
                    if (attr && (attr.name === 'bis_skin_checked' || attr.name === 'bis_size' || attr.name === 'cz-shortcut-listen')) {
                      return null;
                    }
                    return origSetAttrNode.apply(this, arguments);
                  };
                  if (typeof document !== 'undefined') {
                    var clean = function() {
                      var els = document.querySelectorAll('[bis_skin_checked], [bis_size], [cz-shortcut-listen]');
                      for (var i = 0; i < els.length; i++) {
                        els[i].removeAttribute('bis_skin_checked');
                        els[i].removeAttribute('bis_size');
                        els[i].removeAttribute('cz-shortcut-listen');
                      }
                    };
                    clean();
                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', clean);
                    }
                    if (window.MutationObserver) {
                      var obs = new MutationObserver(function(mutations) {
                        for (var i = 0; i < mutations.length; i++) {
                          var m = mutations[i];
                          if (m.type === 'attributes' && (m.attributeName === 'bis_skin_checked' || m.attributeName === 'bis_size' || m.attributeName === 'cz-shortcut-listen')) {
                            m.target.removeAttribute(m.attributeName);
                          }
                        }
                      });
                      obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['bis_skin_checked', 'bis_size', 'cz-shortcut-listen'] });
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased h-full" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
