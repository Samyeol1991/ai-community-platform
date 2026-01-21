import { User, MessageSquare, Zap, Newspaper, Image as ImageIcon, Terminal } from "lucide-react";

export interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

export interface Category {
  id: string;
  name: string;
  icon: any;
  slug: string;
}

export interface Post {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: User;
  category: string;
  likes: number;
  comments: number;
  timestamp: string;
  tags: string[];
}

export const CURRENT_USER: User = {
  id: "u1",
  name: "김알렉스",
  handle: "@alexc",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=150&q=80"
};

export const CATEGORIES: Category[] = [
  { id: "c1", name: "AI 뉴스", icon: Newspaper, slug: "news" },
  { id: "c2", name: "프롬프트", icon: Terminal, slug: "prompts" },
  { id: "c3", name: "쇼케이스", icon: ImageIcon, slug: "showcase" },
  { id: "c4", name: "자유게시판", icon: MessageSquare, slug: "discussion" },
  { id: "c5", name: "모델 공유", icon: Zap, slug: "models" },
];

export const POSTS: Post[] = [
  {
    id: "p1",
    title: "GPT-5 루머: 지금까지 알려진 것들",
    excerpt: "최신 유출 정보에 따르면 추론 능력과 멀티모달 처리에서 비약적인 발전이 있을 것이라고 합니다.",
    content: "최근 GPT-5 출시에 대한 추측이 많습니다. 소식통에 따르면 이 모델은...",
    author: {
      id: "u2",
      name: "이사라",
      handle: "@sconnor",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=150&q=80"
    },
    category: "news",
    likes: 124,
    comments: 45,
    timestamp: "2시간 전",
    tags: ["gpt-5", "루머", "llm"]
  },
  {
    id: "p2",
    title: "미드저니 V6 프롬프트 가이드",
    excerpt: "이 파라미터 조합으로 사실적인 결과를 얻어보세요.",
    content: "수시간의 테스트 끝에 --style raw 파라미터와...",
    author: CURRENT_USER,
    category: "prompts",
    likes: 892,
    comments: 120,
    timestamp: "5시간 전",
    tags: ["midjourney", "생성형아트", "튜토리얼"]
  },
  {
    id: "p3",
    title: "홈 오토메이션을 위한 로컬 LLaMA 3 에이전트 구축",
    excerpt: "조명, 음악 제어부터 식료품 주문까지. 제가 사용한 스택을 공개합니다.",
    content: "Mac Studio에서 LLaMA 3 70B 양자화 버전을 구동 중입니다. 레이턴시는 놀라울 정도로 낮으며...",
    author: {
      id: "u3",
      name: "김데이비드",
      handle: "@dkim_ai",
      avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=150&q=80"
    },
    category: "showcase",
    likes: 56,
    comments: 12,
    timestamp: "1일 전",
    tags: ["local-llm", "llama", "에이전트"]
  },
  {
    id: "p4",
    title: "트랜스포머로 AGI가 정말 가능할까요?",
    excerpt: "어텐션 메커니즘의 한계와 그 다음은 무엇일지에 대한 심층 분석.",
    content: "트랜스포머가 NLP를 혁신했지만, 2차 복잡도 문제와 진정한 세계 모델의 부재라는...",
    author: {
      id: "u4",
      name: "박에밀리",
      handle: "@evance_phd",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=150&q=80"
    },
    category: "discussion",
    likes: 230,
    comments: 89,
    timestamp: "2일 전",
    tags: ["agi", "연구", "딥러닝"]
  }
];
