import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import BrandLogo from '../../components/BrandLogo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import '../../styles/public-experience.css';

export default function NotFoundPage(){
  const {locale}=useI18n();const isAr=locale==='ar';const location=useLocation();
  const links=[{icon:Home,label:isAr?'الرئيسية':'Home',path:'/'},{icon:BookOpen,label:isAr?'الدورات':'Courses',path:'/courses'},{icon:Search,label:isAr?'تواصل معنا':'Contact',path:'/contact'}];
  return <><SEOHead page={{title:isAr?'الصفحة غير موجودة':'Page not found',url:location.pathname,noindex:true,canonical:false}}/><main className="wn-notfound"><motion.section initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} className="wn-notfound__card"><div className="flex justify-center mb-4"><BrandLogo size={58} to={localizedPath('/',locale)}/></div><div className="wn-notfound__code">404</div><h1 className="mt-4 font-[var(--wn-font-display)] text-2xl text-[var(--wn-emerald-deep)]">{isAr?'الصفحة غير موجودة':'Page not found'}</h1><p className="mt-2 text-sm leading-7 text-[var(--wn-text-secondary)]">{isAr?'الرابط قديم أو الصفحة نُقلت. استخدم أحد الروابط التالية للعودة إلى مسار واضح.':'The link may be old or the page moved. Use one of the links below to continue.'}</p><div className="flex flex-wrap justify-center gap-2 mt-6">{links.map(({icon:Icon,label,path})=><Link key={path} to={localizedPath(path,locale)} className="wn-btn wn-btn--secondary"><Icon size={15}/>{label}</Link>)}</div></motion.section></main></>;
}
